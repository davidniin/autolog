# Security policy / Política de seguridad

## Reporting a vulnerability

**Please don't open a public issue.** Report it privately through GitHub:
**Security → Report a vulnerability** in this repository
([private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)).

Include what you found, how to reproduce it and the impact you think it has. You'll get an answer as soon as possible;
this is a volunteer project, so please allow a few days. Once fixed, the advisory is published and you're credited if
you want.

## Supported versions

Only the latest release (and the `main` branch) gets security fixes. Keep your instance updated.

## Scope

AutoLog is self-hosted: each person runs and secures their own instance. Problems in how a specific instance is
configured (a weak `AUTOLOG_TOKEN`, `ALLOW_NO_AUTH=1` on the internet, no HTTPS) are not vulnerabilities in AutoLog,
but suggestions to make the defaults safer are welcome.

---

## Avisar de una vulnerabilidad

**Por favor, no abras un issue público.** Avisa en privado desde GitHub: **Security → Report a vulnerability** en este
repositorio.

Explica qué has encontrado, cómo reproducirlo y qué impacto crees que tiene. Se responderá lo antes posible; es un
proyecto de voluntarios, así que puede tardar unos días. Cuando esté arreglado se publica el aviso y, si quieres,
apareces en los créditos.

Solo la última versión (y la rama `main`) recibe arreglos de seguridad. Cada persona aloja y protege su propia
instancia: una configuración insegura (clave débil, `ALLOW_NO_AUTH=1` en internet, sin HTTPS) no es una vulnerabilidad
de AutoLog, aunque las propuestas para que la configuración por defecto sea más segura son bienvenidas.
