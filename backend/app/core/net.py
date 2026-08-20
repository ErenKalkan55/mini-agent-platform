from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

_BLOCKED_HOSTS = {
    "localhost",
    "localhost.localdomain",
    "metadata",
    "metadata.google.internal",
}


def _ip_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _host_blocked(hostname: str) -> bool:
    host = hostname.strip("[]").lower().rstrip(".")
    if not host:
        return True
    if host in _BLOCKED_HOSTS or host.endswith(".localhost"):
        return True
    if host.isdigit():
        return True
    try:
        return _ip_blocked(ipaddress.ip_address(host))
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror:
        return True
    if not infos:
        return True
    for info in infos:
        try:
            if _ip_blocked(ipaddress.ip_address(info[4][0])):
                return True
        except ValueError:
            return True
    return False


def validate_public_http_url(url: str, *, allow_placeholders: bool = False) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("URL must start with http:// or https://")
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL host is missing")
    if "{" in hostname or "}" in hostname:
        if allow_placeholders:
            return url
        raise ValueError("URL host cannot contain placeholders")
    if _host_blocked(hostname):
        raise ValueError("URL host is not allowed")
    return url
