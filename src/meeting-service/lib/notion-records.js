const text = value => ({ rich_text: value ? [{ text: { content: String(value) } }] : [] });
const title = value => ({ title: [{ text: { content: value } }] });
const date = (value, offset = '') => ({ date: value ? { start: value + offset } : null });
const relation = id => ({ relation: id ? [{ id }] : [] });
const select = name => ({ select: { name } });

export function gatheringProperties(event) {
  return {
    '名稱': title(event.title),
    '聚會 ID': text(event.id),
    '場次名額': { number: event.capacity ?? 6 },
    '開始': date(event.start, '+08:00'),
    '結束': date(event.end, '+08:00'),
    '報名截止': date(event.deadline, '+08:00'),
    '地區': text(event.area),
    '地址': text(event.address),
    '交通': text(event.travel),
    '桌遊安排': text(event.gameNotes),
    '本場主打': text(event.featuredGame),
    '備選遊戲': text(event.backupGame),
    '含教學分鐘': { number: event.teachingMinutes || null },
    '教學方式': text(event.teachingMode),
    '鄰近捷運或地標': text(event.nearby),
    '場地類型': text(event.venueType),
    '已確認成團': { checkbox: !!(event.confirmed || event.published) },
    '狀態': select(event.done ? '完成' : event.closed ? '截止' : event.draft ? '草稿' : '開放'),
  };
}

export function registrationProperties(row, gatheringPageId, playerPageId) {
  return {
    '姓名': title(row.name),
    '報名 ID': text(row.id),
    '團體 ID': text(row.groupId),
    '主揪': { checkbox: row.groupLeader === true },
    '聚會': relation(gatheringPageId),
    '玩家': relation(playerPageId),
    '狀態': select(row.status),
    '報名時間': date(row.at),
    '已付款': { checkbox: row.paid > 0 && row.paid >= (row.due ?? (row.status === '正取' ? 300 : 0)) },
    '應收': { number: row.due ?? (row.status === '正取' ? 300 : 0) },
    '實收': { number: row.paid ?? 0 },
    '偏好': text(row.pref),
    '想玩的遊戲': text(row.wish),
    '出席': text(row.attend),
    '桌次': text(row.table),
    '取消時間': date(row.cancelledAt),
  };
}

// Run under a single writer. An ambiguous create is reconciled by external ID
// before a later run can try it again.
export function notionMeetingRecords({ token, gatheringsDb, registrationsDb, request = fetch }) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
  async function call(path, method, body) {
    const response = await request(`https://api.notion.com/v1/${path}`, {
      headers, method, body: body && JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Notion ${method} returned ${response.status}`);
    return response.json();
  }
  async function find(databaseId, property, id) {
    const matches = await call(`databases/${databaseId}/query`, 'POST', {
      filter: { property, rich_text: { equals: id } }, page_size: 2,
    });
    if (matches.results.length > 1 || matches.has_more) throw new Error('Duplicate Notion record ID');
    return matches.results[0];
  }
  async function upsert(databaseId, property, id, properties) {
    const existing = await find(databaseId, property, id);
    const saved = existing
      ? await call(`pages/${existing.id}`, 'PATCH', { properties })
      : await call('pages', 'POST', { parent: { database_id: databaseId }, properties });
    return saved.id;
  }
  return {
    gathering: event => upsert(gatheringsDb, '聚會 ID', event.id, gatheringProperties(event)),
    registration: (row, gatheringId, playerId) =>
      upsert(registrationsDb, '報名 ID', row.id, registrationProperties(row, gatheringId, playerId)),
    findGathering: id => find(gatheringsDb, '聚會 ID', id),
    findRegistration: id => find(registrationsDb, '報名 ID', id),
  };
}
