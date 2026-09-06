$ErrorActionPreference = 'Stop'
$inputDoc = 'C:\Users\User\rims\RIMS_Work_Summary_Before_Git_Merge_2026-09-04.docx'
$outputPdf = 'C:\Users\User\rims\.docx-qa\rims-handoff\RIMS_Work_Summary_Before_Git_Merge_2026-09-04.pdf'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputPdf) | Out-Null
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($inputDoc, $false, $true)
    try {
        $doc.ExportAsFixedFormat($outputPdf, 17)
    }
    finally {
        $doc.Close($false)
    }
}
finally {
    $word.Quit()
}
Write-Output $outputPdf
