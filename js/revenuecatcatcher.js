// RevenueCat 抓取（只读）：拦截 RC 的产品映射 / 套餐 / 产品 / 订阅状态接口，
// 把产品 ID、权益名、订阅状态整理后弹通知显示，不修改响应内容。
// 拦截的接口：
//   GET  /v1/product_entitlement_mapping
//   GET  /v1/subscribers/<id>/offerings
//   GET  /v1/subscribers/<id>/products
//   GET  /v1/subscribers/<id>
//   POST /v1/receipts
// 抓到的最近一次摘要存在 rc_catcher_last，原始 JSON 存在 rc_catcher_last_json。

function trunc(s, n) {
  s = s == null ? '' : String(s);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

var raw = ($response && $response.body) || '';
if (raw) {
  try {
    var url = ($request && $request.url) || '';
    var host = url.indexOf('rc-backup') !== -1 ? 'api.rc-backup.com' : 'api.revenuecat.com';
    var obj = JSON.parse(raw);
    var title = 'RC 抓取';
    var lines = [];

    if (url.indexOf('product_entitlement_mapping') !== -1) {
      // 产品 ID → 权益名
      title = 'RC 产品 ↔ 权益';
      var map = obj.product_entitlement_mapping || obj;
      Object.keys(map).forEach(function (pid) {
        var v = map[pid];
        var ent = (v && typeof v === 'object') ? (v.entitlement || JSON.stringify(v)) : v;
        lines.push(pid + ' → ' + ent);
      });
    } else if (url.indexOf('/offerings') !== -1) {
      // 套餐与包：offering / package → 实际产品 ID
      title = 'RC 套餐 offerings';
      (obj.offerings || []).forEach(function (o) {
        (o.packages || []).forEach(function (p) {
          lines.push((o.identifier || '') + ' / ' + (p.identifier || '') + ' → ' + (p.platform_product_identifier || ''));
        });
      });
      if (obj.current_offering_id) lines.push('当前套餐: ' + obj.current_offering_id);
    } else if (url.indexOf('/products') !== -1) {
      // 产品列表
      title = 'RC 产品列表';
      (obj.products || []).forEach(function (p) {
        lines.push(p.identifier + ' | ' + trunc(p.title || '', 30) + ' | ' + (p.price_string || (p.price != null ? p.price : '')) + ' ' + (p.subscription_period || ''));
      });
    } else {
      // 订阅状态：GET /v1/subscribers/<id> 或 POST /v1/receipts
      title = 'RC 订阅状态';
      var sub = obj.subscriber || obj;
      var ents = sub.entitlements || {};
      Object.keys(ents).forEach(function (k) {
        var e = ents[k] || {};
        lines.push('权益 ' + k + ' | ' + (e.product_identifier || '') + ' | 到期 ' + (e.expires_date || '无'));
      });
      var subs = sub.subscriptions || {};
      Object.keys(subs).forEach(function (k) {
        var s = subs[k] || {};
        lines.push('订阅 ' + k + ' | 到期 ' + (s.expires_date || '无'));
      });
      var non = sub.non_subscriptions || {};
      Object.keys(non).forEach(function (k) {
        var arr = non[k] || [];
        lines.push('一次性 ' + k + ' × ' + arr.length);
      });
      if (!lines.length) lines.push('当前无权益、无订阅');
    }

    var summary = lines.slice(0, 15).map(function (l) { return trunc(l, 100); });
    if (lines.length > 15) summary.push('…共 ' + lines.length + ' 条');

    try { $persistentStore.write(summary.join('\n'), 'rc_catcher_last'); } catch (e1) {}
    try { $persistentStore.write(trunc(raw, 8000), 'rc_catcher_last_json'); } catch (e2) {}
    $notification.post(title, host + ' · ' + lines.length + ' 条', summary.join('\n') || '无内容');
  } catch (e) {
    try { $notification.post('RC 抓取', '解析失败', trunc(String((e && e.message) || e), 200)); } catch (e3) {}
  }
}
$done({});
