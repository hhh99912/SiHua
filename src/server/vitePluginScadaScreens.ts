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
import {
  loadAllModelsFromDisk,
  saveModelToDisk,
  deleteModelFromDisk,
  ensureModelDirectory
} from './scadaModelStorage';
import {
  loadAllCellsFromDisk,
  saveCellToDisk,
  deleteCellFromDisk,
  ensureCellDirectory
} from './scadaCellStorage';

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
 * 在开发和预览服务器提供 /api/screens/*、/api/models/* 与 /api/cells/* 系列接口
 */
export function scadaScreensPlugin(): Plugin {
  return {
    name: 'vite-plugin-scada-screens',
    configureServer(server) {
      ensureAtLeastOneValidScreen();
      ensureModelDirectory();
      ensureCellDirectory();
      registerEndpoints(server.middlewares);
    },
    configurePreviewServer(server) {
      ensureAtLeastOneValidScreen();
      ensureModelDirectory();
      ensureCellDirectory();
      registerEndpoints(server.middlewares);
    }
  };
}

function registerEndpoints(middlewares: any) {
  middlewares.use(async (req: any, res: any, next: any) => {
    const url = req.url || '';

    // 拦截 /api/screens、/api/templates (/api/models) 与 /api/cells 前缀的请求
    const isScreensApi = url.startsWith('/api/screens');
    const isTemplatesApi = url.startsWith('/api/templates') || url.startsWith('/api/models');
    const isCellsApi = url.startsWith('/api/cells');

    if (!isScreensApi && !isTemplatesApi && !isCellsApi) {
      return next();
    }

    try {
      const parsedUrl = new URL(url, 'http://localhost');
      const pathname = parsedUrl.pathname;
      const method = (req.method || 'GET').toUpperCase();

      // ==================== 自定义图元 API 路由 (存储在 cell/ 目录) ====================
      if (isCellsApi) {
        // 1. GET /api/cells - 获取 cell/ 目录下所有规范图元 JSON
        if (method === 'GET' && (pathname === '/api/cells' || pathname === '/api/cells/')) {
          const result = loadAllCellsFromDisk();
          return sendJson(res, 200, result);
        }

        // 2. POST /api/cells/save 或 /api/cells - 保存单个图元至 cell/<name>.json
        if (method === 'POST' && (pathname === '/api/cells/save' || pathname === '/api/cells')) {
          const body = await parseJsonBody(req);
          if (!body.name) {
            return sendJson(res, 400, { success: false, error: '图元名称不能为空' });
          }
          const result = saveCellToDisk(body);
          return sendJson(res, 200, result);
        }

        // 3. DELETE /api/cells/:name - 删除指定图元文件
        if (method === 'DELETE') {
          let nameToDelete = parsedUrl.searchParams.get('name') || '';
          if (!nameToDelete) {
            const parts = pathname.split('/');
            if (parts.length >= 4) {
              nameToDelete = decodeURIComponent(parts[3]);
            }
          }
          if (!nameToDelete) {
            return sendJson(res, 400, { success: false, error: '未指定要删除的图元名称' });
          }
          const result = deleteCellFromDisk(nameToDelete);
          return sendJson(res, 200, result);
        }

        return sendJson(res, 404, { success: false, error: `未找到图元接口: ${method} ${pathname}` });
      }

      // ==================== 模板 API 路由 (存储在 model/ 目录) ====================
      if (isTemplatesApi) {
        // 1. GET /api/templates 或 /api/models - 获取 model/ 目录下所有模板
        if (method === 'GET' && (pathname === '/api/templates' || pathname === '/api/templates/' || pathname === '/api/models' || pathname === '/api/models/')) {
          const result = loadAllModelsFromDisk();
          return sendJson(res, 200, result);
        }

        // 2. POST /api/templates/save 或 /api/models/save - 保存单个大屏为模板至 model/<name>.json
        if (method === 'POST' && (pathname === '/api/templates/save' || pathname === '/api/models/save' || pathname === '/api/templates' || pathname === '/api/models')) {
          const body = await parseJsonBody(req);
          if (!body.name) {
            return sendJson(res, 400, { success: false, error: '模板名称不能为空' });
          }
          const result = saveModelToDisk(body);
          return sendJson(res, 200, result);
        }

        // 3. DELETE /api/templates/:name 或 /api/models/:name - 删除指定模板文件
        if (method === 'DELETE') {
          let nameToDelete = parsedUrl.searchParams.get('name') || '';
          if (!nameToDelete) {
            const parts = pathname.split('/');
            if (parts.length >= 4) {
              nameToDelete = decodeURIComponent(parts[3]);
            }
          }
          if (!nameToDelete) {
            return sendJson(res, 400, { success: false, error: '未指定要删除的模板名称' });
          }
          const result = deleteModelFromDisk(nameToDelete);
          return sendJson(res, 200, result);
        }

        return sendJson(res, 404, { success: false, error: `未找到模板接口: ${method} ${pathname}` });
      }

      // ==================== 大屏 API 路由 (存储在 graph/ 目录) ====================
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
