import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { CanvasError, createCanvas, joinSession } from '@github/copilot-sdk/extension';

const execFileAsync = promisify(execFile);
const repository = 'zer0big/tailspin-toys-app-20260816';
const servers = new Map();
const priorityOrder = [1, 6, 2];
const priorityReasons = new Map([
    [1, '사용자가 원하는 게임을 찾는 기본 탐색 경로이며 향후 필터 기능과도 자연스럽게 결합됩니다.'],
    [6, '카탈로그 성장에 따른 성능과 사용성 저하를 막는 확장 가능한 데이터 접근 기반입니다.'],
    [2, '검색과 페이지네이션 위에서 탐색 품질을 완성하고 기존 데이터로 빠르게 높은 가치를 냅니다.'],
]);

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function summarize(body) {
    return body.trim().split(/\r?\n\r?\n/, 1)[0] || '설명이 제공되지 않았습니다.';
}

async function loadIssues() {
    const fields = 'number,title,body,labels,assignees,createdAt,updatedAt,url';
    const { stdout } = await execFileAsync(
        'gh',
        ['issue', 'list', '--repo', repository, '--state', 'open', '--limit', '100', '--json', fields],
        { encoding: 'utf8', windowsHide: true },
    );
    return JSON.parse(stdout);
}

function contextButton(issue) {
    return `<button type="button" class="context-button" data-issue-number="${issue.number}"
        data-testid="add-issue-${issue.number}"
        aria-label="이슈 ${issue.number}번을 현재 세션에 추가하고 작업 시작">세션에 추가하고 시작</button>`;
}

function priorityCard(issue, rank) {
    return `<article class="card priority-card" data-testid="priority-issue-${issue.number}">
        <div class="card-header"><span class="rank">우선순위 ${rank}</span>
            <a href="${escapeHtml(issue.url)}" target="_blank" rel="noreferrer">#${issue.number}</a></div>
        <h3>${escapeHtml(issue.title)}</h3>
        <p>${escapeHtml(summarize(issue.body))}</p>
        <div class="reason"><strong>상위 선정 이유</strong>
            <span>${escapeHtml(priorityReasons.get(issue.number))}</span></div>
        ${contextButton(issue)}
    </article>`;
}

function backlogCard(issue) {
    return `<article class="card" data-testid="backlog-issue-${issue.number}">
        <div class="card-header"><span class="backlog-label">대기</span>
            <a href="${escapeHtml(issue.url)}" target="_blank" rel="noreferrer">#${issue.number}</a></div>
        <h3>${escapeHtml(issue.title)}</h3>
        <p>${escapeHtml(summarize(issue.body))}</p>
        ${contextButton(issue)}
    </article>`;
}

function renderHtml(issues) {
    const byNumber = new Map(issues.map((issue) => [issue.number, issue]));
    const priorities = priorityOrder.map((number) => byNumber.get(number)).filter(Boolean);
    const priorityNumbers = new Set(priorities.map((issue) => issue.number));
    const backlog = issues.filter((issue) => !priorityNumbers.has(issue.number));

    return `<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>이슈 트리아지 보드</title>
    <style>
        :root { color-scheme: light dark; }
        * { box-sizing: border-box; }
        body {
            margin: 0; background: var(--background-color-default, #0d1117);
            color: var(--text-color-default, #f0f6fc);
            font: var(--text-body-medium, 14px)/var(--leading-body-medium, 20px)
                var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }
        main { width: min(1180px, 100%); margin: auto; padding: 28px; }
        header, .section-heading, .card-header {
            display: flex; justify-content: space-between; gap: 16px;
        }
        header { align-items: flex-start; margin-bottom: 28px; }
        .section-heading { align-items: end; margin-bottom: 14px; }
        h1 { margin: 0 0 6px; font-size: var(--text-title-large, 26px); line-height: 1.2; }
        h2 { margin: 0 0 4px; font-size: var(--text-title-medium, 20px); }
        h3 { margin: 0; font-size: 16px; line-height: 1.35; }
        p { margin: 0; }
        header p, .section-heading p, .card p, #status {
            color: var(--text-color-muted, #8b949e);
        }
        section + section { margin-top: 34px; }
        .board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .backlog { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .card {
            display: flex; flex-direction: column; gap: 12px; min-width: 0;
            border: 1px solid var(--border-color-default, #30363d); border-radius: 12px;
            background: color-mix(in srgb, var(--background-color-default, #0d1117) 82%, var(--color-white, #fff) 18%);
            padding: 16px;
        }
        .priority-card { border-top: 4px solid var(--true-color-red, #f85149); }
        .card p { flex: 1; }
        .rank, .backlog-label, .count {
            border-radius: 999px; font-size: 12px; font-weight: var(--font-weight-semibold, 600);
            padding: 3px 8px;
        }
        .rank { background: var(--true-color-red-muted, #3d1718); color: var(--true-color-red, #ff7b72); }
        .backlog-label { background: var(--true-color-blue-muted, #13233a); color: var(--true-color-blue, #79c0ff); }
        .count { border: 1px solid var(--border-color-default, #30363d); color: var(--text-color-muted, #8b949e); }
        .reason {
            display: grid; gap: 4px; border-left: 3px solid var(--true-color-red, #f85149);
            border-radius: 0 8px 8px 0; background: var(--true-color-red-muted, #2d1517); padding: 10px 12px;
        }
        a { color: var(--true-color-blue, #58a6ff); font-weight: 600; text-decoration: none; }
        a:hover { text-decoration: underline; }
        button {
            border: 1px solid var(--border-color-default, #30363d); border-radius: 8px;
            background: var(--background-color-default, #21262d); color: var(--text-color-default, #f0f6fc);
            cursor: pointer; font: inherit; font-weight: var(--font-weight-semibold, 600); padding: 9px 13px;
        }
        button:hover { border-color: var(--true-color-blue, #58a6ff); }
        button:focus-visible, a:focus-visible {
            outline: 2px solid var(--color-focus-outline, #58a6ff); outline-offset: 2px;
        }
        .context-button {
            width: 100%; background: var(--true-color-blue, #1f6feb);
            color: var(--color-white, #fff); border-color: transparent;
        }
        button[disabled] { cursor: wait; opacity: .7; }
        #status { min-height: 20px; margin-top: 14px; }
        @media (max-width: 860px) { .board, .backlog { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { main { padding: 18px; } header { flex-direction: column; } #refresh { width: 100%; } }
    </style>
</head>
<body>
    <main>
        <header>
            <div><h1>이슈 트리아지 보드</h1>
                <p>${escapeHtml(repository)} · 열린 이슈 ${issues.length}개</p></div>
            <button type="button" id="refresh" data-testid="refresh-board">새로고침</button>
        </header>
        <section aria-labelledby="priority-heading">
            <div class="section-heading"><div><h2 id="priority-heading">지금 주목할 이슈</h2>
                <p>사용자 영향과 향후 확장성 기준으로 선정했습니다.</p></div>
                <span class="count">${priorities.length}개</span></div>
            <div class="board">${priorities.map((issue, index) => priorityCard(issue, index + 1)).join('')}</div>
        </section>
        <section aria-labelledby="backlog-heading">
            <div class="section-heading"><div><h2 id="backlog-heading">나머지 이슈</h2>
                <p>상위 작업 이후 이어서 검토할 백로그입니다.</p></div>
                <span class="count">${backlog.length}개</span></div>
            <div class="backlog">${backlog.map(backlogCard).join('')}</div>
        </section>
        <p id="status" role="status" aria-live="polite"></p>
    </main>
    <script>
        const status = document.querySelector('#status');
        document.querySelector('#refresh').addEventListener('click', () => location.reload());
        document.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-issue-number]');
            if (!button) return;
            button.disabled = true;
            status.textContent = '이슈 #' + button.dataset.issueNumber + '을 현재 세션에 추가하는 중입니다...';
            try {
                const response = await fetch('/add-context', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ issueNumber: Number(button.dataset.issueNumber) }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || '세션에 추가하지 못했습니다.');
                button.textContent = '세션에 추가됨';
                status.textContent = result.message;
            } catch (error) {
                button.disabled = false;
                status.textContent = error.message;
            }
        });
    </script>
</body>
</html>`;
}

function workPrompt(issue) {
    return `GitHub 이슈 #${issue.number}을 현재 작업 컨텍스트에 추가하고 구현을 시작해 주세요.

제목: ${issue.title}
URL: ${issue.url}

설명:
${issue.body}

저장소 기여 지침을 준수하고 관련 코드를 먼저 조사한 뒤 구현과 검증까지 완료해 주세요.`;
}

async function addIssueToSession(issueNumber, issues) {
    const issue = issues.find((candidate) => candidate.number === issueNumber);
    if (!issue) {
        throw new CanvasError('issue_not_found', `열린 이슈 #${issueNumber}을 찾을 수 없습니다.`);
    }
    await session.send({ prompt: workPrompt(issue) });
    return {
        issueNumber,
        message: `이슈 #${issueNumber}을 현재 세션에 추가했습니다. 작업 요청이 전송되었습니다.`,
    };
}

async function startServer() {
    const entry = { server: null, issues: await loadIssues(), url: '' };
    const server = createServer(async (req, res) => {
        try {
            if (req.method === 'POST' && req.url === '/add-context') {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                const result = await addIssueToSession(input.issueNumber, entry.issues);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(result));
                return;
            }
            if (req.method === 'GET' && req.url === '/') {
                entry.issues = await loadIssues();
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(renderHtml(entry.issues));
                return;
            }
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '요청한 경로를 찾을 수 없습니다.' }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    entry.server = server;
    entry.url = `http://127.0.0.1:${port}/`;
    return entry;
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: 'issue-triage-board',
            displayName: '이슈 트리아지 보드',
            description: '열린 GitHub 이슈를 우선순위별로 보여주고 현재 세션의 작업 컨텍스트에 추가합니다.',
            actions: [
                {
                    name: 'add_issue_to_context',
                    description: '선택한 열린 이슈를 현재 세션에 추가하고 작업 요청을 전송합니다.',
                    inputSchema: {
                        type: 'object',
                        properties: { issueNumber: { type: 'integer', minimum: 1 } },
                        required: ['issueNumber'],
                        additionalProperties: false,
                    },
                    handler: async (ctx) => {
                        const entry = servers.get(ctx.instanceId);
                        if (!entry) throw new CanvasError('canvas_not_open', '먼저 보드를 열어 주세요.');
                        return addIssueToSession(ctx.input.issueNumber, entry.issues);
                    },
                },
                {
                    name: 'refresh_issues',
                    description: 'GitHub에서 열린 이슈 목록을 다시 불러옵니다.',
                    handler: async (ctx) => {
                        const entry = servers.get(ctx.instanceId);
                        if (!entry) throw new CanvasError('canvas_not_open', '먼저 보드를 열어 주세요.');
                        entry.issues = await loadIssues();
                        return { issueCount: entry.issues.length, refreshed: true };
                    },
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer();
                    servers.set(ctx.instanceId, entry);
                }
                return {
                    title: '이슈 트리아지 보드',
                    status: `열린 이슈 ${entry.issues.length}개`,
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(resolve));
                }
            },
        }),
    ],
});
