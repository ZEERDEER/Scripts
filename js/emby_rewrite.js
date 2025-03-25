/**
 * Loon Rewrite: 修改 Emby 请求头
 *
 *  - 替换 Client, Device, Version 字段 (如有需要)
 *  - 替换 User-Agent
 */

const modifiedHeaders = (headers) => {
  let newHeaders = headers;

  // 修改 x-emby-authorization （全部小写）
  if (newHeaders['x-emby-authorization']) {
    newHeaders['x-emby-authorization'] = newHeaders['x-emby-authorization'].replace(/Client="[^"]*"/, 'Client="Emby"').replace(/Version="[^"]*"/, 'Version="2.0.0"');
  } else {
    // 如果没有该头，则新增一个， 以确保请求被正确处理
    newHeaders['x-emby-authorization'] = 'MediaBrowser Client="Emby", Device="iPhone", DeviceId="'+ generateUUID() +'", Version="2.0.0"';
  }
  // 修改 User-Agent
  newHeaders['User-Agent'] = 'Emby/2.0.0 (iPhone; iOS 18.2)'; //根据你使用的设备和 iOS 系统修改
  return newHeaders;
};

function generateUUID() {
    uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    return uuid;
}


// 主要处理函数，Loon 在 HTTP 请求响应时调用
// let response = JSON.parse($response.body); // 将响应体解析为JSON对象
const headers = modifiedHeaders($request.headers);
// $request.headers = headers
$done({
    request: {   // 注意这里是 request
      headers: headers
      }
});
