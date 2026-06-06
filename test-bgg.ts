import axios from 'axios';

async function testThingAPI() {
  try {
    const url = 'https://boardgamegeek.com/xmlapi2/thing?id=167791&stats=1';
    console.log(`正在測試 BGG Thing API...\nURL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/xml, text/xml, */*'
      }
    });
    
    console.log('✅ 測試成功！API 狀態碼：', response.status);
    console.log('回傳資料前 200 字元：\n', response.data.substring(0, 200));
  } catch (error: any) {
    console.error('❌ 測試失敗：', error.response ? error.response.status : error.message);
  }
}

testThingAPI();