import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';

import {generateDocxBuffer} from '../generator.js';

async function createTemplateWithCommands(commands) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  const paragraphs = commands
    .map(
      command => `    <w:p>
      <w:r>
        <w:t>{${command}}</w:t>
      </w:r>
    </w:p>`
    )
    .join('\n');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.folder('word').file('document.xml', documentXml);

  const buffer = await zip.generateAsync({type: 'nodebuffer'});
  const dir = await mkdtemp(join(tmpdir(), 'docx-'));
  const templatePath = join(dir, 'template.docx');
  await writeFile(templatePath, buffer);
  return templatePath;
}

test('generateDocxBuffer keeps helper c after EXEC commands', async () => {
  const templatePath = await createTemplateWithCommands([
    "INS c(undefined,'fallback')",
    'EXEC c = null',
    "INS c(undefined,'fallback')"
  ]);

  const output = await generateDocxBuffer({templatePath, payload: {}});
  const zip = await JSZip.loadAsync(output);
  const documentXml = await zip.file('word/document.xml')?.async('string');

  assert.ok(documentXml, 'Expected generated document to include document.xml');
  const matches = documentXml.match(/fallback/g) || [];
  assert.strictEqual(matches.length, 2);
});
