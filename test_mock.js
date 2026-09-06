const q = {
  select: () => { console.log('select'); return q; },
  from: (table) => { console.log('from', table); return q; },
  where: (cond) => { console.log('where', cond); return q; },
  then: (res, rej) => { console.log('then'); res([{ id: 1 }]); }
};
async function test() {
  const data = await q.select().from('users').where('id=1');
  console.log('result:', data);
}
test();
