Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression.FileSystem

[System.Windows.Forms.Application]::EnableVisualStyles()

function Normalize-Sku([string]$Value) {
  return ([string]$Value).Trim().Trim('*').ToUpperInvariant()
}

function Get-ColumnIndex([string]$CellReference) {
  $letters = ([regex]::Match($CellReference, '^[A-Z]+')).Value
  $index = 0
  foreach ($letter in $letters.ToCharArray()) { $index = ($index * 26) + ([int][char]$letter - [int][char]'A' + 1) }
  return $index - 1
}

function Get-CellText($Cell, [string[]]$SharedStrings) {
  $value = [string]$Cell.v
  if ($Cell.t -eq 's' -and $value -match '^\d+$') { return [string]$SharedStrings[[int]$value] }
  if ($Cell.t -eq 'inlineStr') { return [string]$Cell.is.t }
  return $value
}

function Get-ExcelSkus([string]$Path) {
  $archive = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $sharedStrings = @()
    $sharedEntry = $archive.GetEntry('xl/sharedStrings.xml')
    if ($sharedEntry) {
      $reader = New-Object System.IO.StreamReader($sharedEntry.Open())
      try {
        [xml]$sharedXml = $reader.ReadToEnd()
        $sharedStrings = @($sharedXml.sst.si | ForEach-Object { ($_.t, $_.r.t | Where-Object { $_ }) -join '' })
      } finally { $reader.Dispose() }
    }
    $sheetEntry = $archive.GetEntry('xl/worksheets/sheet1.xml')
    if (-not $sheetEntry) { throw 'У Excel не знайдено перший аркуш.' }
    $sheetReader = New-Object System.IO.StreamReader($sheetEntry.Open())
    try { [xml]$sheetXml = $sheetReader.ReadToEnd() } finally { $sheetReader.Dispose() }

    $rows = @($sheetXml.worksheet.sheetData.row)
    $skuColumn = -1
    $headerRow = -1
    for ($rowIndex = 0; $rowIndex -lt $rows.Count; $rowIndex++) {
      foreach ($cell in @($rows[$rowIndex].c)) {
        $text = (Get-CellText $cell $sharedStrings).Trim().ToLowerInvariant()
        if ($text -match '^(sku|код|артикул|код товару)$') {
          $skuColumn = Get-ColumnIndex $cell.r
          $headerRow = $rowIndex
          break
        }
      }
      if ($skuColumn -ge 0) { break }
    }
    if ($skuColumn -lt 0) { throw 'У Excel не знайдено колонку SKU, «Код» або «Артикул».' }

    $skus = New-Object 'System.Collections.Generic.HashSet[string]'
    for ($rowIndex = $headerRow + 1; $rowIndex -lt $rows.Count; $rowIndex++) {
      foreach ($cell in @($rows[$rowIndex].c)) {
        if ((Get-ColumnIndex $cell.r) -ne $skuColumn) { continue }
        $sku = Normalize-Sku (Get-CellText $cell $sharedStrings)
        if ($sku) { [void]$skus.Add($sku) }
      }
    }
    return $skus
  } finally { $archive.Dispose() }
}

function Get-ProductSku($Node) {
  $names = @('code', 'sku', 'article', 'vendor_code', 'id', 'productcode')
  foreach ($element in @($Node.SelectNodes('.//*'))) {
    if ($names -contains $element.LocalName.ToLowerInvariant()) {
      $sku = Normalize-Sku $element.InnerText
      if ($sku) { return $sku }
    }
  }
  foreach ($attribute in @($Node.Attributes)) {
    if ($names -contains $attribute.LocalName.ToLowerInvariant()) {
      $sku = Normalize-Sku $attribute.Value
      if ($sku) { return $sku }
    }
  }
  return ''
}

function Add-ErcPhotoUrls([string]$XmlPath, [string]$ExcelPath, [string]$OutputPath, [bool]$ReplaceExisting) {
  $excelSkus = Get-ExcelSkus $ExcelPath
  if ($excelSkus.Count -eq 0) { throw 'В Excel не знайдено жодного SKU.' }

  $xml = New-Object System.Xml.XmlDocument
  $xml.PreserveWhitespace = $true
  $xml.Load($XmlPath)
  $products = @($xml.SelectNodes('//*') | Where-Object { @('goods', 'good', 'offer', 'product', 'item') -contains $_.LocalName.ToLowerInvariant() })
  $linked = 0; $alreadyPresent = 0; $notInExcel = 0

  foreach ($product in $products) {
    $sku = Get-ProductSku $product
    if (-not $sku) { continue }
    if (-not $excelSkus.Contains($sku)) { $notInExcel++; continue }
    $url = 'https://www.erc.ua/i/goods/' + [System.Uri]::EscapeDataString($sku) + '.jpg'
    $imageNode = @($product.ChildNodes | Where-Object { @('image', 'image_url', 'photo', 'picture', 'pic') -contains $_.LocalName.ToLowerInvariant() }) | Select-Object -First 1
    if ($imageNode) {
      if ($ReplaceExisting -and $imageNode.InnerText -ne $url) { $imageNode.InnerText = $url; $linked++ }
      else { $alreadyPresent++ }
      continue
    }
    $imageNode = $xml.CreateElement('image')
    $imageNode.InnerText = $url
    [void]$product.AppendChild($imageNode)
    $linked++
  }

  $settings = New-Object System.Xml.XmlWriterSettings
  $settings.Indent = $true
  $settings.Encoding = New-Object System.Text.UTF8Encoding($false)
  $writer = [System.Xml.XmlWriter]::Create($OutputPath, $settings)
  try { $xml.Save($writer) } finally { $writer.Dispose() }

  $reportPath = [System.IO.Path]::ChangeExtension($OutputPath, '.report.txt')
  @(
    "Створено: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "SKU в Excel: $($excelSkus.Count)",
    "Додано або оновлено URL: $linked",
    "Залишено наявних URL: $alreadyPresent",
    "Товарів XML без SKU в Excel: $notInExcel",
    "Вихідний XML: $OutputPath"
  ) | Set-Content -LiteralPath $reportPath -Encoding utf8
  return @{ ExcelSkus = $excelSkus.Count; Linked = $linked; Existing = $alreadyPresent; Missing = $notInExcel; Report = $reportPath }
}

function Pick-OpenFile([string]$Filter, [System.Windows.Forms.TextBox]$Target) {
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Filter = $Filter
  if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $Target.Text = $dialog.FileName }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "ERC XML — підв’язка фото за SKU"
$form.Size = New-Object System.Drawing.Size(760, 340)
$form.MinimumSize = New-Object System.Drawing.Size(760, 340)
$form.StartPosition = 'CenterScreen'
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'Додати URL фото ERC до XML'
$title.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 16)
$title.AutoSize = $true; $title.Location = New-Object System.Drawing.Point(24, 20)
$form.Controls.Add($title)

$hint = New-Object System.Windows.Forms.Label
$hint.Text = 'Оберіть XML і Excel. Програма зіставить SKU та збереже новий XML; вихідний файл не змінюється.'
$hint.AutoSize = $true; $hint.Location = New-Object System.Drawing.Point(26, 54)
$form.Controls.Add($hint)

function Add-FileRow([string]$Caption, [int]$Y, [string]$Filter) {
  $label = New-Object System.Windows.Forms.Label
  $label.Text = $Caption; $label.AutoSize = $true; $label.Location = New-Object System.Drawing.Point(26, $Y + 7)
  $box = New-Object System.Windows.Forms.TextBox
  $box.Location = New-Object System.Drawing.Point(175, $Y); $box.Size = New-Object System.Drawing.Size(470, 28); $box.ReadOnly = $true
  $button = New-Object System.Windows.Forms.Button
  $button.Text = 'Обрати…'; $button.Location = New-Object System.Drawing.Point(655, $Y - 1); $button.Size = New-Object System.Drawing.Size(78, 30)
  $button.Add_Click(({ Pick-OpenFile $Filter $box }.GetNewClosure()))
  $form.Controls.AddRange(@($label, $box, $button))
  return $box
}

$xmlBox = Add-FileRow 'Вихідний XML:' 92 'XML-файли (*.xml)|*.xml'
$excelBox = Add-FileRow 'Excel ERC:' 132 'Excel-файли (*.xlsx)|*.xlsx'
$replace = New-Object System.Windows.Forms.CheckBox
$replace.Text = 'Оновлювати наявні URL фото на URL ERC'; $replace.Checked = $true; $replace.AutoSize = $true; $replace.Location = New-Object System.Drawing.Point(175, 173)
$form.Controls.Add($replace)

$run = New-Object System.Windows.Forms.Button
$run.Text = 'Створити XML із фото'; $run.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10); $run.Location = New-Object System.Drawing.Point(175, 210); $run.Size = New-Object System.Drawing.Size(220, 38)
$form.Controls.Add($run)

$status = New-Object System.Windows.Forms.Label
$status.AutoSize = $true; $status.MaximumSize = New-Object System.Drawing.Size(680, 0); $status.Location = New-Object System.Drawing.Point(26, 270)
$form.Controls.Add($status)

$run.Add_Click({
  try {
    if (-not (Test-Path -LiteralPath $xmlBox.Text)) { throw 'Оберіть XML-файл.' }
    if (-not (Test-Path -LiteralPath $excelBox.Text)) { throw 'Оберіть Excel-файл.' }
    $directory = [System.IO.Path]::GetDirectoryName($xmlBox.Text)
    $base = [System.IO.Path]::GetFileNameWithoutExtension($xmlBox.Text)
    $output = Join-Path $directory ($base + '-with-erc-photos.xml')
    $status.Text = 'Обробка файлів…'; $form.Refresh()
    $result = Add-ErcPhotoUrls $xmlBox.Text $excelBox.Text $output $replace.Checked
    $status.Text = "Готово: додано/оновлено $($result.Linked) URL. Файл: $output"
    [System.Windows.Forms.MessageBox]::Show("Створено XML: $output`n`nДодано/оновлено URL: $($result.Linked)`nSKU в Excel: $($result.ExcelSkus)`nЗвіт: $($result.Report)", 'Готово', 'OK', 'Information') | Out-Null
  } catch {
    $status.Text = 'Помилка: ' + $_.Exception.Message
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Помилка', 'OK', 'Error') | Out-Null
  }
})

[void]$form.ShowDialog()
