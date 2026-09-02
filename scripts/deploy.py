#!/usr/bin/env python3
"""Build the web app and upload dist/apps/web to Hostinger.

Prefers SSH/rsync (port 65002). Falls back to FTP if SSH_* is absent.
Never uploads .env files — production secrets stay on the server.
"""

from __future__ import annotations

import argparse
import ipaddress
import os
import ssl
import subprocess
import sys
import time
from ftplib import FTP, FTP_TLS, error_perm, error_temp
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = REPO_ROOT / "dist" / "apps" / "web"
ENV_FILE = REPO_ROOT / ".env"

SKIP_NAMES = {".env", ".DS_Store", "Thumbs.db"}
SKIP_SUFFIXES = (".map",)

SSH_RESET_HINT = """
Authentification SSH réussie, mais Hostinger ferme la session tout de suite
(Connection reset). Le mot de passe est bon ; le jail SSH n'accepte pas encore
les canaux (SFTP / shell / rsync).

Dans hPanel : Avancé → Accès SSH → activer, puis attendre quelques minutes.
Ensuite relance : npm run deploy:check
""".strip()


def load_env(path: Path) -> dict[str, str]:
    if not path.is_file():
        sys.exit(f"Fichier manquant : {path}")
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        out[key] = value
    return out


def quote_env_value(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def parse_database_url(url: str) -> dict[str, str] | None:
    rest = url.strip()
    if "://" in rest:
        rest = rest.split("://", 1)[1]
    at = rest.rfind("@")
    if at < 0:
        return None
    userpass, hostdb = rest[:at], rest[at + 1 :]
    user, _, password = userpass.partition(":")
    slash = hostdb.find("/")
    hostport = hostdb if slash < 0 else hostdb[:slash]
    dbname = "" if slash < 0 else hostdb[slash + 1 :].split("?", 1)[0]
    if ":" in hostport and hostport.rsplit(":", 1)[-1].isdigit():
        host, port = hostport.rsplit(":", 1)
    else:
        host, port = hostport, "3306"
    return {
        "user": user,
        "password": password,
        "host": host,
        "port": port,
        "dbname": dbname,
    }


def production_api_env(env: dict[str, str]) -> str:
    """Build the Hostinger api/.env from the repo-root .env (never SSH/FTP secrets)."""
    parsed = parse_database_url(env.get("DATABASE_URL") or "") if env.get("DATABASE_URL") else None
    mysql_host = "localhost"
    mysql_port = env.get("MYSQL_PORT") or (parsed["port"] if parsed else "3306")
    mysql_user = env.get("MYSQL_USER") or (parsed["user"] if parsed else "")
    mysql_password = env.get("MYSQL_PASSWORD") or (parsed["password"] if parsed else "")
    mysql_database = env.get("MYSQL_DATABASE") or (parsed["dbname"] if parsed else "")
    if not mysql_user or not mysql_database:
        sys.exit("Impossible de construire api/.env : MYSQL_* ou DATABASE_URL manquant dans .env")
    database_url = (
        f"mysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}"
    )
    keys = {
        "MYSQL_HOST": mysql_host,
        "MYSQL_PORT": mysql_port,
        "MYSQL_USER": mysql_user,
        "MYSQL_PASSWORD": mysql_password,
        "MYSQL_DATABASE": mysql_database,
        "DATABASE_URL": database_url,
        "AUTH_SECRET": env.get("AUTH_SECRET") or "",
        "MANAGER_EMAIL": env.get("MANAGER_EMAIL") or "",
        "MANAGER_PASSWORD": env.get("MANAGER_PASSWORD") or "",
        "MANAGER_NAME": env.get("MANAGER_NAME") or "",
        "SMTP_HOST": env.get("SMTP_HOST") or "",
        "SMTP_PORT": env.get("SMTP_PORT") or "587",
        "SMTP_USER": env.get("SMTP_USER") or "",
        "SMTP_PASS": env.get("SMTP_PASS") or "",
        "SMTP_FROM": env.get("SMTP_FROM") or "",
        "HOSTINGER_EMAIL_MCP_TOKEN": env.get("HOSTINGER_EMAIL_MCP_TOKEN") or "",
        "HOSTINGER_MAIL_MAILBOX_ID": env.get("HOSTINGER_MAIL_MAILBOX_ID") or "",
        "TURNSTILE_SITE_KEY": env.get("TURNSTILE_SITE_KEY") or "",
        "TURNSTILE_SECRET_KEY": env.get("TURNSTILE_SECRET_KEY") or "",
        "TZ": env.get("TZ") or "Europe/Paris",
    }
    lines = ["# Généré par scripts/deploy.py — ne pas éditer à la main si tu redéploies."]
    for key, value in keys.items():
        lines.append(f"{key}={quote_env_value(value)}")
    return "\n".join(lines) + "\n"


def ssh_rsync_file(cfg: dict[str, str], local: Path, remote_rel: str) -> int:
    ssh_opt = (
        f"ssh -p {cfg['port']} -o StrictHostKeyChecking=accept-new "
        f"-o PreferredAuthentications=password -o PubkeyAuthentication=no "
        f"-o NumberOfPasswordPrompts=1"
    )
    remote = f"{cfg['user']}@{cfg['host']}:{cfg['remote'].rstrip('/')}/{remote_rel.lstrip('/')}"
    argv = ["rsync", "-az", "-e", ssh_opt, str(local), remote]
    print(f"rsync → {remote}")
    status, output = spawn_with_password(argv, cfg["password"], timeout=120)
    if looks_like_ssh_reset(output):
        print(SSH_RESET_HINT)
        return 1
    return 0 if status == 0 else status


def upload_production_api_env(cfg: dict[str, str], env: dict[str, str]) -> int:
    import tempfile

    content = production_api_env(env)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", prefix="api-env-", suffix=".env", delete=False) as handle:
        handle.write(content)
        temp_path = Path(handle.name)
    try:
        os.chmod(temp_path, 0o600)
        status = ssh_rsync_file(cfg, temp_path, "api/.env")
        if status == 0:
            print("api/.env de production envoyé (MYSQL_HOST=localhost).")
        return status
    finally:
        temp_path.unlink(missing_ok=True)


def strip_ftp_scheme(value: str) -> str:
    v = value.strip()
    for prefix in ("ftps://", "ftp://", "sftp://"):
        if v.lower().startswith(prefix):
            v = v[len(prefix) :]
            break
    return v.split("/")[0].split(":")[0]


def is_ip_address(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def ssh_config(env: dict[str, str], *, need_password: bool) -> dict[str, str] | None:
    host = strip_ftp_scheme(env.get("SSH_HOST") or "")
    user = env.get("SSH_USER") or ""
    password = env.get("SSH_PASSWORD") or env.get("SSH_PASS") or ""
    port = (env.get("SSH_PORT") or "65002").strip() or "65002"
    remote = (env.get("SSH_REMOTE_DIR") or env.get("FTP_REMOTE_DIR") or ".").strip() or "."
    if not host or not user:
        return None
    if need_password and not password:
        sys.exit("SSH_PASSWORD manquant dans .env")
    return {
        "host": host,
        "user": user,
        "password": password,
        "remote": remote,
        "port": port,
    }


def ftp_config(env: dict[str, str], *, need_password: bool) -> dict[str, str]:
    host = strip_ftp_scheme(env.get("FTP_HOST") or env.get("FTP_IP") or env.get("SSH_HOST") or "")
    user = env.get("FTP_USER") or env.get("SSH_USER") or ""
    password = env.get("FTP_PASS") or env.get("FTP_PASSWORD") or ""
    remote = (env.get("FTP_REMOTE_DIR") or ".").strip() or "."
    port = int(env.get("FTP_PORT") or "21")
    if not host:
        sys.exit("FTP_HOST (ou FTP_IP) manquant dans .env")
    if not user or user.lower().startswith("ftp://"):
        sys.exit("FTP_USER manquant ou invalide dans .env")
    if need_password and not password:
        sys.exit("FTP_PASS manquant dans .env")
    return {
        "host": host,
        "user": user,
        "password": password,
        "remote": remote,
        "port": str(port),
    }


def should_skip(path: Path) -> bool:
    return path.name in SKIP_NAMES or path.name.endswith(SKIP_SUFFIXES)


def iter_local_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_NAMES and not d.startswith(".")]
        for name in filenames:
            local = Path(dirpath) / name
            if should_skip(local):
                continue
            files.append(local)
    files.sort()
    return files


def run_build() -> None:
    print("→ npm run build")
    subprocess.run(["npm", "run", "build"], cwd=REPO_ROOT, check=True)


def prepare_files(skip_build: bool) -> list[Path]:
    if not skip_build:
        run_build()
    if not DIST_DIR.is_dir():
        sys.exit(f"Build introuvable : {DIST_DIR}")
    return iter_local_files(DIST_DIR)


def looks_like_ssh_reset(text: str) -> bool:
    lowered = text.lower()
    return "connection reset" in lowered or "broken pipe" in lowered


def spawn_with_password(argv: list[str], password: str, timeout: int = 120):
    import pexpect

    child = pexpect.spawn(argv[0], argv[1:], encoding="utf-8", timeout=timeout)
    child.logfile_read = sys.stdout
    try:
        while True:
            idx = child.expect(
                [
                    r"(?i)are you sure you want to continue connecting",
                    r"(?i)password:",
                    pexpect.EOF,
                    pexpect.TIMEOUT,
                ]
            )
            if idx == 0:
                child.sendline("yes")
                continue
            if idx == 1:
                child.sendline(password)
                child.expect(pexpect.EOF)
                break
            break
    finally:
        child.close()
    output = (child.before or "") + (str(child.after) if child.after else "")
    status = child.exitstatus
    if status is None:
        status = 1
    return status, output


def ssh_check(cfg: dict[str, str]) -> int:
    argv = [
        "ssh",
        "-p",
        cfg["port"],
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "PreferredAuthentications=password",
        "-o",
        "PubkeyAuthentication=no",
        "-o",
        "NumberOfPasswordPrompts=1",
        f"{cfg['user']}@{cfg['host']}",
        "pwd; ls -la; echo ---; find ~ -maxdepth 4 -type d -name public_html 2>/dev/null",
    ]
    print(f"SSH {cfg['user']}@{cfg['host']}:{cfg['port']}")
    status, output = spawn_with_password(argv, cfg["password"], timeout=40)
    if looks_like_ssh_reset(output):
        print(SSH_RESET_HINT)
        return 1
    if status != 0:
        return status
    print(f"OK — dossier distant prévu : {cfg['remote']}")
    return 0


def ssh_deploy(cfg: dict[str, str], files: list[Path], args: argparse.Namespace, env: dict[str, str]) -> int:
    if not files:
        print("Rien à envoyer.")
        return 0
    ssh_opt = (
        f"ssh -p {cfg['port']} -o StrictHostKeyChecking=accept-new "
        f"-o PreferredAuthentications=password -o PubkeyAuthentication=no "
        f"-o NumberOfPasswordPrompts=1"
    )
    # macOS ships openrsync 2.6.9 — no --info / --human-readable / GNU long extras.
    argv = [
        "rsync",
        "-azv",
        "--exclude=.env",
        "--exclude=.DS_Store",
        "--exclude=*.map",
        "-e",
        ssh_opt,
    ]
    if args.delete:
        argv.append("--delete")
    if args.dry_run:
        argv.append("-n")
    argv += [f"{DIST_DIR}/", f"{cfg['user']}@{cfg['host']}:{cfg['remote']}/"]
    print(f"rsync → {cfg['user']}@{cfg['host']}:{cfg['remote']}")
    status, output = spawn_with_password(argv, cfg["password"], timeout=600)
    if looks_like_ssh_reset(output):
        print(SSH_RESET_HINT)
        return 1
    if status != 0:
        print(f"rsync a échoué (code {status}).")
        return status
    print(f"Fichiers envoyés ({len(files)}).")
    if not args.skip_api_env:
        env_status = upload_production_api_env(cfg, env)
        if env_status != 0:
            print("api/.env n'a pas pu être envoyé — le calendrier restera sans base.")
            return env_status
    print("Terminé.")
    return 0


def ftp_connect(cfg: dict[str, str], *, force_plain: bool) -> FTP:
    host, port = cfg["host"], int(cfg["port"])
    user, password = cfg["user"], cfg["password"]
    if not force_plain:
        contexts: list[ssl.SSLContext] = [ssl.create_default_context()]
        if is_ip_address(host):
            insecure = ssl.create_default_context()
            insecure.check_hostname = False
            insecure.verify_mode = ssl.CERT_NONE
            contexts.append(insecure)
        last_error: Exception | None = None
        for ctx in contexts:
            try:
                ftp = FTP_TLS(context=ctx, timeout=45)
                ftp.connect(host, port)
                ftp.login(user, password)
                ftp.prot_p()
                ftp.set_pasv(True)
                print(f"Connecté en FTPS à {host}:{port}")
                return ftp
            except Exception as exc:
                last_error = exc
        print(f"FTPS indisponible ({last_error}). Tentative FTP clair…")
    ftp = FTP(timeout=45)
    ftp.connect(host, port)
    ftp.login(user, password)
    ftp.set_pasv(True)
    print(f"Connecté en FTP à {host}:{port}")
    return ftp


def posix_parent(rel: str) -> str:
    parent = str(Path(rel).parent).replace("\\", "/")
    return parent if parent != "." else ""


def ensure_remote_dir(ftp: FTP, home: str, rel: str) -> None:
    ftp.cwd(home)
    if rel in ("", ".", "/"):
        return
    for part in rel.replace("\\", "/").split("/"):
        if not part or part == ".":
            continue
        try:
            ftp.cwd(part)
        except error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def remote_size(ftp: FTP, name: str) -> int | None:
    try:
        size = ftp.size(name)
    except (error_perm, error_temp, OSError):
        return None
    return int(size) if size is not None else None


def upload_file(ftp: FTP, home: str, local: Path, remote_rel: str) -> str:
    ensure_remote_dir(ftp, home, posix_parent(remote_rel))
    filename = Path(remote_rel).name
    existing = remote_size(ftp, filename)
    if existing is not None and existing == local.stat().st_size:
        return "skip"
    with local.open("rb") as handle:
        ftp.storbinary(f"STOR {filename}", handle)
    return "upload"


def ftp_deploy(cfg: dict[str, str], files: list[Path], args: argparse.Namespace) -> int:
    print(f"Fichiers à envoyer : {len(files)}")
    print(f"Cible FTP : {cfg['user']}@{cfg['host']}:{cfg['remote']}")
    if args.dry_run:
        for local in files:
            print(f"  [dry-run] {local.relative_to(DIST_DIR).as_posix()}")
        return 0

    ftp = ftp_connect(cfg, force_plain=args.plain)
    try:
        login_dir = ftp.pwd()
        ensure_remote_dir(ftp, login_dir, cfg["remote"])
        remote_home = ftp.pwd()
        uploaded = skipped = failed = 0
        for index, local in enumerate(files, start=1):
            rel = local.relative_to(DIST_DIR).as_posix()
            try:
                status = upload_file(ftp, remote_home, local, rel)
            except (error_perm, error_temp, OSError) as exc:
                print(f"  [{index}/{len(files)}] ERREUR {rel} — {exc}")
                failed += 1
                time.sleep(0.4)
                continue
            if status == "skip":
                skipped += 1
                mark = "="
            else:
                uploaded += 1
                mark = "↑"
            print(f"  [{index}/{len(files)}] {mark} {rel}")
        print(f"Terminé : {uploaded} envoyés, {skipped} inchangés, {failed} erreurs")
        return 1 if failed else 0
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Déploie Escape Occitanie sur Hostinger (SSH/rsync, sinon FTP).")
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--delete", action="store_true", help="Supprimer sur le serveur les fichiers absents du build")
    parser.add_argument("--plain", action="store_true", help="Forcer FTP sans TLS")
    parser.add_argument("--ftp", action="store_true", help="Forcer FTP même si SSH est configuré")
    parser.add_argument("--check", action="store_true", help="Tester la connexion et quitter")
    parser.add_argument("--skip-api-env", action="store_true", help="Ne pas envoyer api/.env de production")
    args = parser.parse_args()

    env = load_env(ENV_FILE)
    ssh = None if args.ftp else ssh_config(env, need_password=not args.dry_run)

    if args.check:
        if ssh:
            return ssh_check(ssh)
        cfg = ftp_config(env, need_password=True)
        ftp = ftp_connect(cfg, force_plain=args.plain)
        print(f"OK FTP — répertoire distant : {ftp.pwd()}")
        ftp.quit()
        return 0

    files = prepare_files(args.skip_build)
    print(f"Fichiers à envoyer : {len(files)}")

    if args.dry_run and ssh:
        print(f"Cible SSH : {ssh['user']}@{ssh['host']}:{ssh['remote']}")
        for local in files:
            print(f"  [dry-run] {local.relative_to(DIST_DIR).as_posix()}")
        return 0

    if ssh:
        return ssh_deploy(ssh, files, args, env)
    return ftp_deploy(ftp_config(env, need_password=not args.dry_run), files, args)


if __name__ == "__main__":
    raise SystemExit(main())
