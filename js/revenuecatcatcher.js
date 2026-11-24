// RevenueCat 抓取（只读）：拦截 RC 的产品映射 / 套餐 / 产品 / 订阅状态接口，
// 请求阶段删 etag，强制服务器返回新鲜的 200（而不是 304 缓存），这样响应阶段才能抓到内容；
// 响应阶段把产品 ID、权益名、订阅状态整理后弹通知显示，不修改响应内容。
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

if (typeof $response === 'undefined') {
  // 请求阶段：去掉缓存标识，逼服务器返回完整响应
  delete $request.headers['x-revenuecat-etag'];
  delete $request.headers['X-RevenueCat-ETag'];
  $done({ headers: $request.headers });
} else {
  var raw = ($response && $response.body) || '';
  var url = ($request && $request.url) || '';
  // attributes 接口只上报用户属性、返回 {}，不带任何订阅信息，直接放过
  if (raw && url.indexOf('/attributes') === -1) {
    try {
      var host = url.indexOf('rc-backup') !== -1 ? 'api.rc-backup.com' : 'api.revenuecat.com';
      var obj = JSON.parse(raw);
      var title = 'RC 抓取';
      var lines = [];
      var subtitle = null;

      if (url.indexOf('product_entitlement_mapping') !== -1) {
        // 产品 ID → 权益名；映射存起来，供套餐那条直接给出填写值
        title = 'RC 产品 ↔ 权益';
        var map = obj.product_entitlement_mapping || obj;
        var entSet = {};
        Object.keys(map).forEach(function (pid) {
          var v = map[pid];
          var ent;
          if (v && typeof v === 'object') {
            if (v.entitlement) ent = v.entitlement;
            else if (Array.isArray(v.entitlements)) ent = v.entitlements.join(', ');
            else if (v.entitlements) ent = v.entitlements;
            else ent = JSON.stringify(v);
          } else ent = v;
          if (ent) entSet[ent] = 1;
          lines.push(pid + ' → ' + ent);
        });
        try { $persistentStore.write(JSON.stringify(map), 'rc_mapping_json'); } catch (e7) {}
        var entKeys = Object.keys(entSet);
        if (entKeys.length === 1) lines.push('name 填 ' + entKeys[0]);
      } else if (url.indexOf('/offerings') !== -1) {
        // 套餐与包：每种产品只列一行短格式（$rc_annual → 产品 ID），通知不用展开就能看全；
        // 同一个产品在多个套餐里出现时只留一行；最后直接给出填写值
        title = 'RC 套餐 offerings';
        var seen = {};
        var prods = [];
        (obj.offerings || []).forEach(function (o) {
          (o.packages || []).forEach(function (p) {
            var pid = p.platform_product_identifier || '';
            if (pid && !seen[pid]) {
              seen[pid] = 1;
              prods.push({ pkg: p.identifier || '', pid: pid });
            }
          });
        });
        prods.forEach(function (pr) { lines.push(pr.pkg + ' → ' + pr.pid); });
        // 从之前抓到的映射里找权益名
        var fillName = '';
        try {
          var mRaw = $persistentStore.read('rc_mapping_json');
          if (mRaw) {
            var mObj = JSON.parse(mRaw);
            var entSet2 = {};
            Object.keys(mObj).forEach(function (pid) {
              var v = mObj[pid];
              var e = null;
              if (v && typeof v === 'object') {
                if (v.entitlement) e = v.entitlement;
                else if (Array.isArray(v.entitlements) && v.entitlements.length) e = v.entitlements[0];
                else if (v.entitlements) e = v.entitlements;
              } else if (v) e = v;
              if (e) entSet2[e] = 1;
            });
            var ek = Object.keys(entSet2);
            if (ek.length === 1) fillName = ek[0];
          }
        } catch (e8) {}
        // 推荐 appid：年付优先，其次终身，否则第一个
        var rec = '';
        prods.forEach(function (pr) { if (!rec && pr.pkg.indexOf('annual') !== -1) rec = pr.pid; });
        if (!rec) prods.forEach(function (pr) { if (!rec && pr.pkg.indexOf('lifetime') !== -1) rec = pr.pid; });
        if (!rec && prods.length) rec = prods[0].pid;
        if (fillName) lines.push('name 填 ' + fillName);
        if (rec) lines.push('appid 填 ' + rec);
        if (obj.current_offering_id) subtitle = host + ' · 当前 ' + obj.current_offering_id;
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
      // 把抓到的内容写进脚本日志：点通知进来的记录页 Log 区就能看到完整内容
      try { console.log('[RC] ' + title + '\n' + summary.join('\n')); } catch (e4) {}
      $notification.post(title, subtitle || (host + ' · ' + lines.length + ' 条'), summary.join('\n') || '无内容');
    } catch (e) {
      try { console.log('[RC] 解析失败: ' + trunc(String((e && e.message) || e), 500)); } catch (e6) {}
      try { $notification.post('RC 抓取', '解析失败', trunc(String((e && e.message) || e), 200)); } catch (e3) {}
    }
  }
  $done({});
}
