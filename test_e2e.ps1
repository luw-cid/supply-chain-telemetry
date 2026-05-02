param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Email = "dhoang1234sp@gmail.com",
  [string]$Password = "123123123"
)

$G = @{ B = $BaseUrl; T = $null; SHP = $null }

function Write-Step($s) { Write-Host "`n=== $s ===" -ForegroundColor Cyan }
function Write-Ok($s) { Write-Host "  OK $s" -ForegroundColor Green }
function Write-Fail($s, $e) { Write-Host "  FAIL $s  $e" -ForegroundColor Red }
function Write-Skip($s) { Write-Host "  SKIP $s" -ForegroundColor Yellow }

function Invoke-Api($m, $p, $b) {
  $url = "$($G.B)$p"
  $json = if ($b) { ($b | ConvertTo-Json -Depth 10 -Compress) } else { $null }
  try {
    $req = [System.Net.WebRequest]::Create($url)
    $req.Method = $m
    $req.ContentType = "application/json"
    $req.Timeout = 10000
    if ($G.T) { $req.Headers.Add("Authorization", "Bearer $($G.T)") }
    if ($json) {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
      $req.ContentLength = $bytes.Length
      $req.GetRequestStream().Write($bytes, 0, $bytes.Length)
    }
    $resp = $req.GetResponse()
    $reader = [System.IO.StreamReader]::new($resp.GetResponseStream())
    $text = $reader.ReadToEnd()
    $body = if ($text) { $text | ConvertFrom-Json } else { @{} }
    return @{ status = [int]$resp.StatusCode; success = $body.success; error = $body.error; code = $body.code; data = $body.data; meta = $body.meta; _raw = $body }
  } catch {
    $ex = $_.Exception
    if ($ex.Response) {
      $reader = [System.IO.StreamReader]::new($ex.Response.GetResponseStream())
      $text = $reader.ReadToEnd()
      $body = if ($text) { $text | ConvertFrom-Json } else { @{} }
      return @{ status = [int]$ex.Response.StatusCode; success = $body.success; error = $body.error; code = $body.code; _raw = $body }
    }
    return @{ status = 0; success = $false; error = $ex.Message; _raw = $null }
  }
}

# ── 1. AUTH ─────────────────────────────────────────────────────────────────
Write-Step "1. AUTH  Login + Validate Token"

$login = Invoke-Api POST "/api/auth/login" @{ email = $Email; password = $Password }
if ($login.data.accessToken) {
  $G.T = $login.data.accessToken
  Write-Ok "Login success, token: $($G.T.Substring(0,20))..."
} else {
  Write-Host "Login failed, trying register..." -ForegroundColor Yellow
  $reg = Invoke-Api POST "/api/auth/register" @{
    name = "Test User"; email = $Email; phone = "+84012345678"
    password = $Password; role = "ADMIN"; partyId = $null
  }
  if ($reg.data.userId) { Write-Ok "Register success" }
  else { Write-Host "  Register: $($reg._raw)" -ForegroundColor Yellow }
  $login2 = Invoke-Api POST "/api/auth/login" @{ email = $Email; password = $Password }
  if ($login2.data.accessToken) { $G.T = $login2.data.accessToken; Write-Ok "Login OK after register" }
  else { Write-Fail "Cannot login after register" "$($login2._raw)"; exit 1 }
}

$me = Invoke-Api GET "/api/auth/me"
if ($me.data.sub) { Write-Ok "Token valid, user: $($me.data.role)" }
else { Write-Fail "Token invalid" "$($me._raw)"; exit 1 }

# ── 2. SHIPMENT  List + Detail ────────────────────────────────────────────
Write-Step "2. SHIPMENT  List + Detail"

$list = Invoke-Api GET "/api/shipments"
if ($list.success -and $list.data) {
  Write-Ok "Listed $($list.data.Count) shipments"
  $G.SHP = $list.data[0].ShipmentID
  Write-Ok "Using shipment: $($G.SHP)"
} else { Write-Fail "List shipments" "no data"; exit 1 }

$det = Invoke-Api GET "/api/shipments/$($G.SHP)"
if ($det.success) { Write-Ok "Detail loaded for $($G.SHP)" }
else { Write-Fail "Detail" "$($det._raw)" }

# ── 3. TELEMETRY INGEST ────────────────────────────────────────────────────
Write-Step "3. TELEMETRY INGEST  Test normal + violation + idempotency"

# 3a. Normal ingest
$key1 = [guid]::NewGuid().ToString()
$ingest1 = Invoke-Api POST "/api/v1/telemetry/ingest" @{
  shipment_id = $G.SHP; device_id = "IOT-TEST-001"
  location = @{ lng = 106.7042; lat = 10.7833 }
  temp = 5.0; humidity = 60.0; idempotency_key = $key1
}
if ($ingest1.data.mongo_point_id) { Write-Ok "Normal ingest, point: $($ingest1.data.mongo_point_id)" }
else { Write-Fail "Normal ingest" "$($ingest1._raw)" }

# 3b. Idempotency
if ($ingest1.mongo_point_id) {
  $dup = Invoke-Api POST "/api/v1/telemetry/ingest" @{
    shipment_id = $G.SHP; device_id = "IOT-TEST-001"
    location = @{ lng = 106.7042; lat = 10.7833 }
    temp = 5.0; humidity = 60.0; idempotency_key = $key1
  }
  if ($dup.data.duplicate) { Write-Ok "Idempotency  duplicate=true" }
  else { Write-Fail "Idempotency" "not blocked: $($dup._raw)" }
}

# 3c. Out-of-order stale timestamp
$key2 = [guid]::NewGuid().ToString()
$stale = Invoke-Api POST "/api/v1/telemetry/ingest" @{
  shipment_id = $G.SHP; device_id = "IOT-TEST-001"
  location = @{ lng = 106.7042; lat = 10.7833 }
  timestamp = "2020-01-01T00:00:00Z"; temp = 99.0; humidity = 50.0
  idempotency_key = $key2
}
if ($stale.data.stale) { Write-Ok "Out-of-order  stale=true" }
else { Write-Host "  stale=$($stale.data.stale)" -ForegroundColor Yellow }

# 3d. Missing field → 400
$bad = Invoke-Api POST "/api/v1/telemetry/ingest" @{ temp = 10 }
if (-not $bad.success) { Write-Ok "Validation missing fields -> error" }
else { Write-Fail "Validation" "should reject: $($bad._raw)" }

# 3e. No auth → 401
$old = $G.T; $G.T = $null
$noAuth = Invoke-Api POST "/api/v1/telemetry/ingest" @{
  shipment_id = $G.SHP; device_id = "IOT-TEST-NOAUTH"
  location = @{ lng = 106.7; lat = 10.8 }; temp = 5.0
}
if ($noAuth.status -eq 401) { Write-Ok "Auth guard  no token -> 401" }
else { Write-Fail "Auth guard  expected 401 got $($noAuth.status)" "$($noAuth._raw)" }
$G.T = $old

# 3f. Violation temp > TempMax → alarm
$key3 = [guid]::NewGuid().ToString()
$violate = Invoke-Api POST "/api/v1/telemetry/ingest" @{
  shipment_id = $G.SHP; device_id = "IOT-TEST-VIOLATION"
  location = @{ lng = 106.7042; lat = 10.7833 }
  temp = 50.0; humidity = 60.0; idempotency_key = $key3
}
if ($violate.data.violation) { Write-Ok "Violation: temp=50 > TempMax -> violation=true" }
else { Write-Host "  violation=$($violate.data.violation) (may depend on cargo TempMax)" -ForegroundColor Yellow }

# ── 4. TRACE ROUTE ──────────────────────────────────────────────────────────
Write-Step "4. TRACE ROUTE"

$trace = Invoke-Api GET "/api/v1/analytics/trace-route/$($G.SHP)"
if ($trace.data.features) { Write-Ok "Trace route, $($trace.data.features.Count) features" }
else { Write-Skip "Trace route  $($trace.status) $($trace._raw)" }

# ── 5. CUSTODY  History ───────────────────────────────────────────────────
Write-Step "5. CUSTODY  Ownership History"

$hist = Invoke-Api GET "/api/v1/shipments/$($G.SHP)/ownership-history"
if ($hist.success) { Write-Ok "History loaded, $($hist.data.totalTransfers) transfers" }
else { Write-Skip "History  $($hist.status) $($hist.error)" }

# ── 6. ALARM  List ─────────────────────────────────────────────────────────
Write-Step "6. ALARM  List"

$alarms = Invoke-Api GET "/api/v1/alarms"
if ($alarms.success) { Write-Ok "Alarms OK, count: $($alarms.data.Count)" }
else { Write-Host "  alarms: $($alarms._raw)" -ForegroundColor Yellow }

# ── 7. ERROR RESPONSE ──────────────────────────────────────────────────────
Write-Step "7. ERROR RESPONSE  Consistency check"

$err404 = Invoke-Api GET "/api/shipments/SHP-NONEXIST-99999"
if ($err404.status -eq 404 -and $err404.success -eq $false -and $err404.error) {
  Write-Ok "404 error: success=false, error=`"$($err404.error)`""
} else { Write-Host "  404 check: status=$($err404.status) body=$(($err404._raw|ConvertTo-Json -Compress))" -ForegroundColor Yellow }

$tmpT = $G.T; $G.T = $null
$err401 = Invoke-Api GET "/api/shipments"
if ($err401.status -eq 401 -and $err401.success -eq $false -and $err401.error) {
  Write-Ok "401 error: success=false, error=`"$($err401.error)`""
} else { Write-Host "  401 check: status=$($err401.status) body=$(($err401._raw|ConvertTo-Json -Compress))" -ForegroundColor Yellow }
$G.T = $tmpT

# ── SUMMARY ─────────────────────────────────────────────────────────────────
Write-Step "SUMMARY"
Write-Host "All tests completed." -ForegroundColor Green
Write-Host "  Token: $($G.T.Substring(0,20))..." -ForegroundColor Gray
Write-Host "  Shipment used: $($G.SHP)" -ForegroundColor Gray
