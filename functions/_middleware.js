/**
 * Cloudflare Pages 中间件 —— 拦截不该公开的开发文件
 *
 * 背景：本项目的 Build output directory 设为 `/`（仓库根目录），
 * 导致 dev/ 工具脚本、README.md、.gitignore 等也会被托管出去。
 * 这些文件没有敏感信息，但对一个对外接单的网站来说观感不好。
 *
 * 这里在静态资源之前做一层拦截，命中规则直接返回 404。
 * 不用 `_redirects` 是因为它只支持跳转，用 200 代理会被搜索引擎判为重复内容。
 *
 * 注意：如果以后把 Build output directory 改成 `dist`（只打包网站文件），
 * 这个中间件就可以删掉了。
 */

const BLOCKED_PREFIXES = ['/dev/'];
const BLOCKED_EXACT = ['/dev', '/README.md', '/.gitignore', '/.vercelignore'];

export async function onRequest(context) {
  try {
    const { pathname } = new URL(context.request.url);

    const blocked =
      BLOCKED_EXACT.includes(pathname) ||
      BLOCKED_PREFIXES.some((p) => pathname.startsWith(p)) ||
      /\/\.[^/]+$/.test(pathname); // 任何点开头的隐藏文件

    if (blocked) {
      return new Response('404 Not Found', {
        status: 404,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-robots-tag': 'noindex'
        }
      });
    }
  } catch (e) {
    // 中间件出问题也不能影响正常访问，直接放行
  }

  return context.next();
}
