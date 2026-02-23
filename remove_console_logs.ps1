$filePath = "components\pages\InvoicePage.tsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Remove console.log statements (single line and multi-line)
$content = $content -replace '(?m)^\s*console\.(log|warn|error|info|debug)\([^)]*\);?\s*$\r?\n', ''
$content = $content -replace 'console\.(log|warn|error|info|debug)\([^)]*\);?\s*', ''

# Remove empty lines that might have been left
$content = $content -replace '(?m)^\s*$\r?\n', ''

Set-Content $filePath -Value $content -Encoding UTF8 -NoNewline

Write-Host "Removed all console.log statements from InvoicePage.tsx"
