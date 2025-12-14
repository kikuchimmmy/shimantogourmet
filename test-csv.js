// CSVデータテストスクリプト
const sheetId = '1itlpjo95O019S1EZYI3k9dJ0prRivYd9drMH8icTpAI';
const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?exportFormat=csv&gid=0`;

async function testCSV() {
    console.log('Fetching CSV from:', csvUrl);
    
    const response = await fetch(csvUrl);
    const csvText = await response.text();
    
    console.log('\n=== CSV Full Text (first 2000 chars) ===');
    console.log(csvText.substring(0, 2000));
    
    console.log('\n=== Split by lines ===');
    const lines = csvText.split('\n');
    console.log(`Total lines: ${lines.length}`);
    
    // 半平の行を探す
    console.log('\n=== Looking for 半平 ===');
    lines.forEach((line, index) => {
        if (line.includes('半平')) {
            console.log(`Line ${index}: ${line}`);
            console.log(`Length: ${line.length}`);
            
            // CSVパース
            const columns = parseCSVLine(line);
            console.log(`Columns count: ${columns.length}`);
            columns.forEach((col, i) => {
                console.log(`  Column ${i}: "${col}"`);
            });
        }
    });
    
    // みなくちの行を探す
    console.log('\n=== Looking for みなくち ===');
    lines.forEach((line, index) => {
        if (line.includes('みなくち')) {
            console.log(`Line ${index}: ${line}`);
            console.log(`Length: ${line.length}`);
            
            // CSVパース
            const columns = parseCSVLine(line);
            console.log(`Columns count: ${columns.length}`);
            columns.forEach((col, i) => {
                console.log(`  Column ${i}: "${col}"`);
            });
        }
    });
}

// CSV行パーサー
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

testCSV().catch(console.error);
