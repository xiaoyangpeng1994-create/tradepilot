$url   = 'https://tradepilot-xiaoyangpeng1994-create.aws-ap-northeast-1.turso.io/v2/pipeline'
$token = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzgzMjc2NTcsImlkIjoiMDE5ZTBjOTEtZWEwMS03MzY5LWE0ZjYtZjhkNGIxZjg2MjY0IiwicmlkIjoiMTRjYjczYjUtOGMxZC00MWRhLWI1MmQtMWQwMGY2ODUwNWRmIn0.PU3J-HAOUVCHPqUfLgZtk8CotnAj4FTTs6j6RpqVRK5QGt2PSjN7wJqB0KFljFFbI3CNVlSWllg67q-wnKCXAQ'

$headers = @{
    Authorization  = "Bearer $token"
    'Content-Type' = 'application/json'
}

# 所有建表 SQL（顺序很重要：先建父表再建子表）
$statements = @(
    # 1. User
    'CREATE TABLE IF NOT EXISTS "User" (id TEXT PRIMARY KEY, nickname TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL, email TEXT UNIQUE, phone TEXT UNIQUE, computePts INTEGER NOT NULL DEFAULT 2000, walletBalance INTEGER NOT NULL DEFAULT 0, vipLevel TEXT NOT NULL DEFAULT ''FREE'', vipExpiresAt DATETIME, parentAgentId TEXT, agentLevel INTEGER NOT NULL DEFAULT 0, tradingStyle TEXT NOT NULL DEFAULT ''LEARNING'', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (parentAgentId) REFERENCES "User"(id))',

    # 2. Order
    'CREATE TABLE IF NOT EXISTS "Order" (id TEXT PRIMARY KEY, userId TEXT NOT NULL, type TEXT NOT NULL, amountCny INTEGER NOT NULL, itemCode TEXT NOT NULL, status TEXT NOT NULL DEFAULT ''PENDING'', paidAt DATETIME, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (userId) REFERENCES "User"(id))',

    # 3. CommissionLog
    'CREATE TABLE IF NOT EXISTS "CommissionLog" (id TEXT PRIMARY KEY, orderId TEXT NOT NULL, recipientId TEXT NOT NULL, payerId TEXT NOT NULL, payerNickname TEXT NOT NULL, rate REAL NOT NULL, amountCny INTEGER NOT NULL, level INTEGER NOT NULL, note TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (orderId) REFERENCES "Order"(id), FOREIGN KEY (recipientId) REFERENCES "User"(id))',

    # 4. ChatSession
    'CREATE TABLE IF NOT EXISTS "ChatSession" (id TEXT PRIMARY KEY, userId TEXT NOT NULL, channel TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL, summary TEXT, summaryUpdatedAt DATETIME, messageCountAtSummary INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (userId) REFERENCES "User"(id))',

    # 5. ChatMessage
    'CREATE TABLE IF NOT EXISTS "ChatMessage" (id TEXT PRIMARY KEY, sessionId TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, imageData TEXT, followupCount INTEGER NOT NULL DEFAULT 0, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (sessionId) REFERENCES "ChatSession"(id) ON DELETE CASCADE)',

    # 6. AnonQuota
    'CREATE TABLE IF NOT EXISTS "AnonQuota" (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, count INTEGER NOT NULL DEFAULT 0, resetAt DATETIME NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL)',

    # 7. Trade
    'CREATE TABLE IF NOT EXISTS "Trade" (id TEXT PRIMARY KEY, userId TEXT NOT NULL, symbol TEXT NOT NULL, channel TEXT, direction TEXT NOT NULL, entryPrice REAL NOT NULL, stopPrice REAL, targetPrice REAL, exitPrice REAL, pnlPct REAL, status TEXT NOT NULL DEFAULT ''OPEN'', setup TEXT, timeframe TEXT, notes TEXT, openedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, closedAt DATETIME, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL, FOREIGN KEY (userId) REFERENCES "User"(id))',

    # 8. Indexes
    'CREATE INDEX IF NOT EXISTS "AnonQuota_resetAt_idx" ON "AnonQuota"(resetAt)',
    'CREATE INDEX IF NOT EXISTS "Trade_userId_openedAt_idx" ON "Trade"(userId, openedAt)',
    'CREATE INDEX IF NOT EXISTS "Trade_userId_status_idx" ON "Trade"(userId, status)',

    # 9. Prisma migrations table (让 Prisma 知道 schema 已同步)
    'CREATE TABLE IF NOT EXISTS "_prisma_migrations" (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, finished_at DATETIME, migration_name TEXT NOT NULL, logs TEXT, rolled_back_at DATETIME, started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, applied_steps_count INTEGER NOT NULL DEFAULT 0)'
)

$requests = @()
foreach ($sql in $statements) {
    $requests += @{ type = 'execute'; stmt = @{ sql = $sql } }
}
$requests += @{ type = 'close' }

$body = @{ requests = $requests } | ConvertTo-Json -Depth 10

Write-Host "正在推送 schema 到 Turso..." -ForegroundColor Cyan

try {
    $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "✅ Schema 推送成功！" -ForegroundColor Green
    $resp | ConvertTo-Json -Depth 5
} catch {
    Write-Host "❌ 推送失败：$($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd()
    }
}
