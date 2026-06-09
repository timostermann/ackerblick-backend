# Firmware ↔ Backend Contract

Context for the Ackerblick backend architect and developer. This describes the
HTTP contract and runtime behavior of the ESP32 firmware
(`ackerblick-firmware`) as it is actually implemented today, plus the
behavioral and forward-looking context that should shape the backend design.

The backend does not exist yet. The firmware targets **`https://api.ackerblick.com/v1/readings`**
(configured in the firmware's `config.h`); the path can be adjusted to match the
final backend route.

---

## 1. The HTTP contract (what the device sends today)

The device makes **one HTTP request per wake cycle**:

```
POST https://api.ackerblick.com/v1/readings
Content-Type: application/json
X-API-Key: <shared static key>

{
  "deviceId": "hochbeet-001",
  "soilMoisture": 42,
  "temperature": 22.5,
  "humidity": 55.1,
  "pressure": 1013.2
}
```

`temperature`, `humidity`, and `pressure` are **optional** — omitted when the BME280 fails to initialise or is absent. `soilMoisture` is always present.

| Field          | Type    | Unit | Semantics                                                                                                          |
| -------------- | ------- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| `deviceId`     | string  | —    | Stable device identity. Currently hardcoded `"hochbeet-001"`. Will become per-plot (one device per rented garden). |
| `soilMoisture` | integer | %    | Calibrated soil moisture **0–100**. Clamped on-device by the capacitive sensor library.                            |
| `temperature`  | float   | °C   | Air temperature from the BME280. Sensor is board-mounted; readings run ~1–3 °C high due to ESP32 self-heating.     |
| `humidity`     | float   | % RH | Relative humidity from the BME280.                                                                                 |
| `pressure`     | float   | hPa  | Absolute air pressure from the BME280 (Pa ÷ 100 on-device).                                                        |

- Field names are deliberately **semantic, not hardware-specific** (no
  `adc_raw`). Keep this convention server-side.
- **Single reading per request** — no batching, no arrays.

## 2. Auth

- **`X-API-Key` HTTP header**, a single shared static string baked into firmware
  flash.
- Treat it as a **low-trust secret**: it's plaintext in firmware, not rotated,
  and the same across devices today. Don't use it as anything more than a coarse
  gate. Plan for **per-device keys** later (the device identity is already in the
  body, so the backend can map key→deviceId when ready).

## 3. TLS

- The device currently connects over HTTPS but with **certificate validation
  disabled** (`setInsecure()`) — prototype only.
- **`api.ackerblick.com` must serve HTTPS with a publicly-trusted cert** (e.g.
  Let's Encrypt). The firmware will switch to CA validation before production, so
  a valid chain becomes a hard requirement then.

## 4. Device behavior the backend must assume

The device is **not a reliable client** — this is the most important section for
backend design:

- **Fire-and-forget, no retry.** If the POST fails (or WiFi doesn't connect
  within 20 s), the reading is **silently dropped** and the device sleeps until
  the next cycle. No on-device buffering of missed readings → **expect gaps in
  the time series**, don't treat them as anomalies.
- **Deep sleep between readings**, ~every **15 minutes** → roughly
  **96 requests/device/day**. The device is fully powered down between cycles and
  **unreachable** — the backend cannot push to it.
- **The device has no synced clock.** Deep sleep loses time; there's no RTC/NTP.
  **The payload carries no timestamp.** → **The server must stamp receive time**
  (`receivedAt`) as the authoritative timestamp for each reading.
- **The device ignores the response body.** It logs the status code and body for
  debugging but takes no action on them today. Any **2xx** is treated as success;
  non-2xx is just logged. Return a small JSON or empty body — keep it minimal.

## 5. Recommended backend shape (derived from the above)

- **Endpoint:** a single `POST` route that accepts the JSON above. Return
  `200`/`201`, minimal body.
- **Timestamp server-side** (`receivedAt`); store as a per-device time series
  keyed by `deviceId`.
- **Validate** `soilMoisture` is an int in `[0,100]`; flag out-of-range (a
  stuck-at-0 can indicate a miscalibrated or disconnected sensor — useful as a
  health signal).
- **Tolerate duplicates** even though the device doesn't currently retry — if
  retry is added later, occasional dupes shouldn't corrupt data. Idempotency
  isn't required yet, but design so it's cheap to add.
- **Extensible schema.** A **BME280** sensor arrives next and will add
  `temperature`, `humidity`, `pressure` (semantic names) to the same payload.
  Don't model the table around a single moisture column.

## 6. Forward-looking: the irrigation channel

The product includes **optional automated irrigation**. Because the device
deep-sleeps and is otherwise unreachable, **the only way to send anything back to
a device is in the HTTP response to its POST** (pull-based, latency up to one
15-minute cycle). If/when irrigation commands are designed, that response body is
the channel — worth keeping in mind even though the firmware ignores it today.
This argues for the POST endpoint returning a structured (even if currently
empty) command object from day one.

## 7. Out of current scope

No LoRa, no camera, no multi-parcel fan-out, no OTA, no device-side time, no auth
beyond the shared key. Strict prototype.
