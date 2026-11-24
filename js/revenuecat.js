// RevenueCat 解锁（恢复订阅模板）：按插件设置里填的权益名与产品 ID，
// 把订阅状态改成 2099 年到期的有效订阅。
// 两个值从插件的输入里读（Loon 会把 #!input 存进 $persistentStore）：
//   name  = 权益名 entitlement，如 pro
//   appid = 产品 ID，如 com.xxx.pro.yearly
// 请求阶段删掉 etag 头，强制服务器返回新鲜的 200（而不是 304 缓存），
// 响应阶段只改带 subscriber 字段的返回（订阅信息 / 收据），其他接口原样放过。
// 没填 name 或 appid 时不做任何改动。

var out = {};
var name = $persistentStore.read('name');
var appid = $persistentStore.read('appid');

if (!name || !appid) {
  // 未配置：原样放过
  $done(out);
} else if (typeof $response === 'undefined') {
  // 请求阶段：去掉缓存标识，逼服务器返回完整响应
  delete $request.headers['x-revenuecat-etag'];
  delete $request.headers['X-RevenueCat-ETag'];
  out.headers = $request.headers;
  $done(out);
} else {
  // 响应阶段：注入订阅
  try {
    var obj = JSON.parse($response.body || 'null');
    if (obj && obj.subscriber) {
      obj.subscriber.subscriptions = obj.subscriber.subscriptions || {};
      obj.subscriber.entitlements = obj.subscriber.entitlements || {};
      var data = {
        'product_identifier': appid,
        'expires_date': '2099-09-09T09:09:09Z',
        'purchase_date': '2023-09-09T09:09:09Z'
      };
      obj.subscriber.entitlements[name] = data;
      obj.subscriber.subscriptions[appid] = {
        'product_identifier': appid,
        'expires_date': '2099-09-09T09:09:09Z',
        'purchase_date': '2023-09-09T09:09:09Z',
        'original_purchase_date': '2023-09-09T09:09:09Z',
        'store': 'app_store',
        'ownership_type': 'PURCHASED'
      };
      out.body = JSON.stringify(obj);
    }
  } catch (e) {
    // 解析失败：原样放过
  }
  $done(out);
}
