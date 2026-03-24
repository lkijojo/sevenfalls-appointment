function findEmptyRoom(date, startT, endT, appts) {
    const sMin = timeToMin(startT);
    const eMin = timeToMin(endT);
    // 普通分房逻辑：只在 Room 1-4 中寻找，保留 Room 5 给情侣
    return ROOMS.slice(0, 4).find(r => !appts.some(a => 
        a.date === date && a.room.id === r.id && (sMin < timeToMin(a.end) && eMin > timeToMin(a.start))
    )) || ROOMS[0];
}

function processBulk(rawData, date, appts, callback) {
    const lines = rawData.trim().split('\n');
    lines.forEach(line => {
        const p = line.split(/\s+/);
        if(p.length >= 3){
            const dur = DUR_MAP[p[2].toUpperCase().replace('CP','')] || 60; // 识别缩写并移除CP标签
            const isCP = p[2].toUpperCase().includes('CP'); // 检查是否带 CP 标记
            const staff = STAFF.find(s => s.name.toLowerCase() === p[1].toLowerCase());
            
            if(staff){
                const endT = minToTime(timeToMin(p[0]) + dur + 10);
                let room;
                if (isCP) {
                    room = ROOMS.find(r => r.id === 5); // 批量导入带 CP 强制 Room 5
                } else {
                    room = findEmptyRoom(date, p[0], endT, appts);
                }
                
                const weight = (dur >= 90 ? 3 : 2);
                appts.push({ date, start: p[0], end: endT, room, staff: staff.name, type: (isCP?"👫 ":"") + p[2], weight });
                staff.score += weight;
            }
        }
    });
    callback();
}