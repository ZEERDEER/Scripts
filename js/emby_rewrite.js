/**
 * Loon Rewrite: 修改 Emby 请求头
 *
 *  - 替换 Client, Device, Version 字段 (如有需要)
 *  - 替换 User-Agent
 */
const modifiedHeaders = (headers) => {
  let newHeaders = { ...headers };

  // 修改 x-emby-authorization
  if (newHeaders['x-emby-authorization']) {
    newHeaders['x-emby-authorization'] = newHeaders['x-emby-authorization']
      .replace(/Client="[^"]*"/, 'Client="Emby"')
      .replace(/Version="[^"]*"/, 'Version="2.0.0"');
  } else {
    // 如果没有该头，则新增一个，确保请求被正确处理
    newHeaders['x-emby-authorization'] = 'MediaBrowser Client="Emby", Device="iPhone", DeviceId="' + generateUUID() + '", Version="2.0.0"';
  }

  // 修改 User-Agent
  newHeaders['User-Agent'] = 'Emby/2.0.0 (iPhone; iOS 18.2)'; // 根据实际设备和系统修改
  return newHeaders;
};

// UUID 生成函数
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 调试日志: 输出原始 headers 和修改后的 headers
console.log("触发脚本: Emby 请求头修改");
console.log("原始请求头:", $request.headers);

// 调用修改函数
const headers = modifiedHeaders($request.headers);

// 输出修改后的 headers，方便调试
console.log("修改后的请求头:", headers);

// 返回处理后的请求头
$done({
  headers: headers
});
