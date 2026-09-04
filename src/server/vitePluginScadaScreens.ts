import type { Plugin } from 'vite';
import {
  loadAllScreensFromDisk,
  saveOneScreenToDisk,
  deleteScreenFromDisk,
  getStorageConfig,
  ensureAtLeastOneValidScreen,
  getIndexScreenConfig,
  setIndexScreenConfig
} from './scadaScreenStorage';

/**
 * 辅助函数：从 http.IncomingMessage 解析 JSON 请求体
 */
function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: any) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * 辅助函数：发送统一的 JSON 响应
 */
function sendJson(res: any, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

/**
 * SCADA 大屏 JSON 磁盘文件存储 Vite 插件
 * 目录固定在运行根目录同级 graph/ 文件夹下
 * 在开发和预览服务器提供 /api/screens/* 系列接口
 */
export function scadaScreensPlugin(): Plugin {
  return {
    name: 'vite-plugin-scada-screens',
    configureServer(server) {
      registerEndpoints(server.middlewares);
    },
    configurePreviewServer(server) {
      registerEndpoints(server.middlewares);
    }
  };
}

function registerEndpoints(middlewares: any) {
  middlewares.use(async (req: any, res: any, next: any) => {
    const url = req.url || '';

    // 仅拦截 /api/screens 前缀的请求
    if (!url.startsWith('/api/screens')) {
      return next();
    }

    try {
      const parsedUrl = new URL(url, 'http://localhost');
      const pathname = parsedUrl.pathname;
      const method = (req.method || 'GET').toUpperCase();

      // 1. GET /api/screens/config - 获取固定 graph 存储配置、文件合法性状态与主索引大屏
      if (method === 'GET' && pathname === '/api/screens/config') {
        const config = getStorageConfig();
        return sendJson(res, 200, { success: true, ...config });
      }

      // 2. GET /api/screens/index-screen - 获取配置的登录主索引大屏
      if (method === 'GET' && pathname === '/api/screens/index-screen') {
        const indexConfig = getIndexScreenConfig();
        return sendJson(res, 200, { success: true, ...indexConfig });
      }

      // 3. POST /api/screens/index-screen - 设置用户登录成功后的主索引大屏
      if (method === 'POST' && pathname === '/api/screens/index-screen') {
        const body = await parseJsonBody(req);
        const indexScreenName = (body.indexScreenName || '').trim();
        const indexScreenId = (body.indexScreenId || '').trim();
        if (!indexScreenName && !indexScreenId) {
          return sendJson(res, 400, { success: false, error: '大屏名称或 ID 不能为空' });
        }
        const result = setIndexScreenConfig(indexScreenName, indexScreenId);
        return sendJson(res, 200, result);
      }

      // 4. POST /api/screens/reset-presets - 确保或重置写入保底合理预设大屏
      if (method === 'POST' && pathname === '/api/screens/reset-presets') {
        const created = ensureAtLeastOneValidScreen(true);
        const data = loadAllScreensFromDisk();
        return sendJson(res, 200, { success: true, createdFiles: created, ...data });
      }

      // 5. POST /api/screens/save-one - 仅保存当前选中的这一个大屏到 graph/<name>.json
      if (method === 'POST' && pathname === '/api/screens/save-one') {
        const body = await parseJsonBody(req);
        if (!body.screen || !body.screen.name) {
          return sendJson(res, 400, { success: false, error: '大屏数据及名称不能为空' });
        }
        const result = saveOneScreenToDisk(body.screen, body.oldName);
        return sendJson(res, 200, result);
      }

      // 6. DELETE /api/screens/:name 或 DELETE /api/screens?name=... - 删除指定大屏文件
      if (method === 'DELETE' && url.startsWith('/api/screens')) {
        let nameToDelete = parsedUrl.searchParams.get('name') || '';
        if (!nameToDelete) {
          const parts = pathname.split('/');
          if (parts.length >= 4) {
            nameToDelete = decodeURIComponent(parts[3]);
          }
        }

        if (!nameToDelete) {
          return sendJson(res, 400, { success: false, error: '未指定要删除的大屏名称' });
        }

        const result = deleteScreenFromDisk(nameToDelete);
        return sendJson(res, 200, result);
      }

      // 7. GET /api/screens 或 /api/screens/load-all - 从 graph 目录加载所有合理的大屏 JSON 文件
      if (method === 'GET' && (pathname === '/api/screens' || pathname === '/api/screens/' || pathname === '/api/screens/load-all')) {
        const result = loadAllScreensFromDisk();
        return sendJson(res, 200, result);
      }

      // 未匹配的 /api/screens 路由
      return sendJson(res, 404, { success: false, error: `未找到接口: ${method} ${pathname}` });
    } catch (err: any) {
      console.error('[Vite SCADA Plugin] 接口处理异常:', err);
      return sendJson(res, 500, { success: false, error: err?.message || '内部服务器错误' });
    }
  });
}
