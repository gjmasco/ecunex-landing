# Instrucciones para implementar el formulario de contacto de ECUNEX

Necesito implementar el backend para recibir el formulario de solicitud de dealer de la landing page de ECUNEX y enviar los datos por SMTP.

Antes de modificar archivos, revisa la arquitectura existente del proyecto y reutiliza sus patrones para endpoints, validación, configuración, logging, errores, rate limiting y pruebas. No rompas endpoints ni funcionalidades existentes.

## Contexto del frontend

La landing page es estática y envía una petición JSON mediante:

```http
POST /api/dealer-applications
Content-Type: application/json
Accept: application/json
```

El formulario actual envía estos campos:

```json
{
  "fullName": "Nombre y apellido",
  "company": "Nombre de la empresa o taller",
  "email": "correo@empresa.com",
  "phone": "+5491122334455",
  "country": "Argentina",
  "monthlyVolume": "1-10",
  "message": "Comentarios adicionales",
  "website": ""
}
```

El frontend se encuentra en:

```text
index.html
js/main.js
```

El formulario actualmente usa:

```html
action="/api/dealer-applications"
method="post"
```

No se utilizará CAPTCHA por ahora.

El campo `website` es un honeypot. Los usuarios normales lo dejan vacío. Si contiene algún valor, la solicitud no debe enviar ningún correo.

---

## 1. Crear el endpoint

Crear el endpoint:

```http
POST /api/dealer-applications
```

Puede implementarse como Minimal API o Controller, según la arquitectura existente del proyecto.

Debe aceptar JSON y devolver respuestas JSON.

### Respuesta exitosa

Cuando el mensaje se envíe correctamente:

```http
200 OK
```

```json
{
  "success": true,
  "message": "Application received."
}
```

El frontend considera cualquier respuesta HTTP `2xx` como exitosa.

### Respuestas de error

Para datos inválidos:

```http
400 Bad Request
```

```json
{
  "success": false,
  "error": "Invalid application data."
}
```

Para exceso de solicitudes:

```http
429 Too Many Requests
```

```json
{
  "success": false,
  "error": "Too many requests. Please try again later."
}
```

Para errores internos o SMTP:

```http
500 Internal Server Error
```

```json
{
  "success": false,
  "error": "Unable to process the application."
}
```

No devolver credenciales, detalles internos, excepciones ni información sensible al cliente.

---

## 2. Crear un modelo de entrada fuertemente tipado

Crear un DTO equivalente al siguiente, adaptándolo al namespace y convenciones del proyecto:

```csharp
public sealed class DealerApplicationRequest
{
    public string FullName { get; init; } = string.Empty;
    public string Company { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string Country { get; init; } = string.Empty;
    public string MonthlyVolume { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string Website { get; init; } = string.Empty;
}
```

Usar el estilo de nombres que ya tenga el proyecto. El JSON debe aceptar correctamente:

```text
fullName
company
email
phone
country
monthlyVolume
message
website
```

No usar `object`, `dynamic`, `Dictionary<string, object>` ni casts innecesarios.

---

## 3. Validaciones obligatorias

Validar siempre en el backend, aunque el frontend también valide.

### Campos requeridos

Estos campos son obligatorios:

```text
fullName
company
email
phone
country
monthlyVolume
```

El campo `message` es opcional.

Rechazar valores nulos, vacíos o compuestos únicamente por espacios.

### Límites máximos

Aplicar estos límites:

```text
fullName:       máximo 100 caracteres
company:        máximo 120 caracteres
email:          máximo 150 caracteres
phone:          máximo 30 caracteres
country:        máximo 80 caracteres
monthlyVolume:  máximo 30 caracteres
message:        máximo 2000 caracteres
website:        máximo 100 caracteres
```

Rechazar valores que superen los límites. No truncar silenciosamente el contenido.

### Email

Validar que `email` tenga un formato válido.

No utilizar el email recibido directamente como dirección `From`. El email del usuario solamente debe utilizarse como `Reply-To`.

### Teléfono

Validar que el teléfono tenga un formato razonable. Debe permitir números, espacios, paréntesis, guiones y opcionalmente el signo `+`.

No aplicar una validación excesivamente estricta que rechace formatos internacionales legítimos.

### Honeypot

Si:

```text
website != ""
```

no se debe enviar ningún correo.

Se puede responder `400 Bad Request` o una respuesta controlada que parezca exitosa para no ayudar a los bots, según la estrategia anti-bot del proyecto. En ningún caso se debe generar un email.

### `monthlyVolume`

Si los valores permitidos ya existen en el frontend, validar contra esa lista.

Si no existe una lista centralizada, permitir valores no vacíos de hasta 30 caracteres.

No aceptar contenido HTML peligroso dentro del mensaje. El email debe enviarse como texto plano o con HTML correctamente escapado.

---

## 4. Configurar SMTP mediante configuración segura

No guardar credenciales SMTP en el código fuente ni en el repositorio.

Crear una sección de configuración equivalente a:

```json
{
  "Smtp": {
    "Host": "",
    "Port": 587,
    "Username": "",
    "Password": "",
    "EnableSsl": true,
    "FromAddress": "",
    "FromName": "ECUNEX Website",
    "ToAddress": "info@ecunex.com"
  }
}
```

No incluir contraseñas reales en `appsettings.json`, ejemplos, commits o logs.

Usar:

- Variables de entorno.
- Secret Manager durante desarrollo.
- Secretos del proveedor de hosting en producción.

Variables recomendadas:

```text
SMTP_HOST
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
SMTP_ENABLE_SSL
SMTP_FROM_ADDRESS
SMTP_FROM_NAME
SMTP_TO_ADDRESS
```

El password SMTP nunca debe aparecer en logs ni en respuestas HTTP.

Validar al iniciar la aplicación que la configuración SMTP requerida exista y sea válida. Si falta una configuración necesaria, informar el error en logs de forma clara y no intentar enviar mensajes con una configuración incompleta.

---

## 5. Implementar el envío de email

Implementar un servicio separado, por ejemplo:

```text
IEmailSender
SmtpEmailSender
```

Evitar poner toda la lógica SMTP directamente dentro del endpoint.

Usar la librería SMTP ya aprobada por el proyecto. Si no existe ninguna, seleccionar una librería mantenida y agregarla correctamente al archivo de dependencias, justificando el cambio.

El mensaje debe configurarse así:

```text
From: cuenta SMTP configurada
To: dirección SMTP_TO_ADDRESS configurada
Reply-To: email enviado por el usuario
Subject: New ECUNEX dealer application - {company}
```

El cuerpo debe incluir todos los datos:

```text
New ECUNEX dealer application

Name: {fullName}
Company: {company}
Email: {email}
Phone: {phone}
Country: {country}
Estimated monthly flashes: {monthlyVolume}

Message:
{message}
```

Preferentemente enviar el cuerpo como texto plano. Si se utiliza HTML, escapar todos los valores recibidos para evitar inyección de contenido.

No permitir que el usuario controle:

```text
From
To
SMTP host
SMTP credentials
```

El servicio debe ser asíncrono y respetar los patrones de cancelación ya utilizados por el proyecto.

---

## 6. Manejo de errores

Si el SMTP falla:

- Registrar el error usando el logger estándar del backend.
- No registrar la contraseña ni el contenido completo de credenciales.
- No filtrar la excepción al frontend.
- Devolver `500`.
- No responder como exitoso si el correo no fue enviado.

Ejemplo de log aceptable:

```text
Dealer application email could not be sent.
```

El detalle técnico puede quedar únicamente en los logs internos.

No utilizar bloques `catch` vacíos ni fallos silenciosos.

Si el endpoint recibe JSON inválido, responder con `400` siguiendo el formato de errores ya utilizado por el proyecto.

---

## 7. Rate limiting

Como no se utilizará CAPTCHA, agregar protección contra spam mediante rate limiting.

Aplicar como mínimo:

```text
Máximo 5 solicitudes por IP cada 10 minutos
```

Si el proyecto ya tiene rate limiting, reutilizar la infraestructura existente.

Si está detrás de un proxy o reverse proxy, configurar correctamente `ForwardedHeaders` para identificar la IP real. No confiar ciegamente en headers manipulables por el cliente.

La respuesta cuando se exceda el límite debe ser:

```http
429 Too Many Requests
```

No enviar el email cuando la solicitud sea rechazada por el rate limit.

---

## 8. CORS y publicación

La landing puede estar publicada en GitHub Pages o en otro dominio.

Si el frontend y la API están en dominios diferentes, configurar CORS para permitir únicamente los dominios reales de la landing, por ejemplo:

```text
https://www.ecunex.com
https://ecunex.com
```

No usar una política abierta como:

```text
AllowAnyOrigin
```

junto con credenciales.

Como la petición utiliza JSON, permitir únicamente lo necesario:

```text
POST
Content-Type
Accept
```

Si la API se publica bajo el mismo dominio mediante reverse proxy, mantener esta URL:

```text
/api/dealer-applications
```

Si la API queda en otro dominio, habrá que cambiar el `action` del formulario frontend a la URL completa de la API, por ejemplo:

```html
action="https://api.ecunex.com/api/dealer-applications"
```

El endpoint debe estar disponible exclusivamente mediante HTTPS en producción.

---

## 9. Logs y observabilidad

Registrar solamente información útil y no sensible:

- Fecha y hora.
- Resultado del envío.
- Empresa, si es necesario.
- Motivo general del rechazo.
- Error técnico interno del SMTP.

No registrar:

- Password SMTP.
- Tokens o secretos.
- Datos completos innecesarios del formulario.
- Cabeceras de autenticación.
- Credenciales.

---

## 10. Pruebas automatizadas

Agregar pruebas automatizadas usando el framework y patrones de testing existentes.

### Caso exitoso

Una solicitud válida debe:

- Devolver `200`.
- Llamar al servicio SMTP.
- Enviar el email a `SMTP_TO_ADDRESS`.
- Usar la cuenta SMTP configurada como `From`.
- Usar el email del formulario como `Reply-To`.
- Incluir todos los campos en el cuerpo.

### Campo obligatorio ausente

Una solicitud sin `fullName`, `company`, `email`, `phone`, `country` o `monthlyVolume` debe:

- Devolver `400`.
- No llamar al servicio SMTP.

### Email inválido

Debe devolver `400` y no enviar correo.

### Mensaje demasiado largo

Debe devolver `400` y no enviar correo.

### Honeypot completado

Si `website` contiene texto:

- No enviar correo.
- Devolver una respuesta no exitosa o una respuesta controlada según la estrategia anti-bot.

### Error SMTP

Si el servicio SMTP falla:

- Devolver `500`.
- Registrar el error.
- No filtrar detalles internos en la respuesta.

### Rate limit

Al superar el límite:

- Devolver `429`.
- No enviar correo.

### JSON inválido

Debe devolver `400` sin llamar al servicio SMTP.

---

## 11. Criterios de aceptación

La tarea estará terminada cuando:

- Exista `POST /api/dealer-applications`.
- Acepte exactamente los campos del formulario actual.
- Valide todos los datos en el servidor.
- Respete el honeypot `website`.
- Envíe el correo mediante SMTP.
- Use `From` fijo y `Reply-To` del usuario.
- No exponga credenciales.
- Tenga rate limiting básico.
- Tenga CORS configurado para el dominio real.
- Devuelva `2xx` únicamente cuando el correo se haya enviado correctamente.
- Devuelva errores claros sin información sensible.
- Tenga pruebas automatizadas para validación, SMTP, honeypot, rate limiting y errores.
- Documente las variables de entorno necesarias.
- No rompa otros endpoints existentes.

Antes de terminar:

1. Ejecutar el formateador del proyecto si existe.
2. Ejecutar el linter o análisis estático si existe.
3. Ejecutar:

```bash
dotnet build
dotnet test
```

4. Revisar el diff completo.
5. Confirmar que no se incluyeron secretos reales.
6. Proporcionar ejemplos de configuración para desarrollo y producción sin contraseñas reales.

---

## Variables que se deben completar en el hosting

El desarrollador debe dejar documentadas estas variables para que se configuren con los datos reales del proveedor SMTP:

```text
SMTP_HOST
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
SMTP_ENABLE_SSL
SMTP_FROM_ADDRESS
SMTP_FROM_NAME
SMTP_TO_ADDRESS
```

Ejemplo sin contraseña real:

```text
SMTP_HOST=smtp.tuproveedor.com
SMTP_PORT=587
SMTP_USERNAME=info@ecunex.com
SMTP_PASSWORD=CONFIGURAR_COMO_SECRETO_EN_EL_HOSTING
SMTP_ENABLE_SSL=true
SMTP_FROM_ADDRESS=info@ecunex.com
SMTP_FROM_NAME=ECUNEX Website
SMTP_TO_ADDRESS=info@ecunex.com
```

No enviar la contraseña por el chat ni agregarla al repositorio. Configurarla directamente como secreto en el servidor donde está alojada la API.
