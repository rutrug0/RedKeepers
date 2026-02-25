# Mara Voss Working Notes

- 2026-02-25 queue recovery (`RK-M0-0004`): closed the stale RK-M1-0001 escalation chain artifacts (RK-M1-0001-ESC, RK-M1-0001-ESC-ESC, RK-M1-0001-ESC-ESC-ESC, RK-M1-0001-ESC-ESC-ESC-ESC) and requeued eligible blocked items (RK-M0-0003, RK-M1-0002, RK-M1-0001, RK-M0-0002).
- Root cause: Windows subprocess npm shim resolution behavior during Codex bootstrap. PowerShell may resolve `codex` to `codex.ps1`, but Python subprocess execution required the npm shim executable path (`codex.cmd`), which caused repeated false `command not found` failures before the bootstrap fix.
