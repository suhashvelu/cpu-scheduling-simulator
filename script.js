function generateInputFields() {
    const count = parseInt(document.getElementById('processCount').value);
    const type = document.getElementById('schedulingType').value;
    const container = document.getElementById('inputs');
    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
        container.innerHTML += `
            <div class="row mb-2">
                <div class="col">
                    <input type="text" class="form-control" placeholder="Process ${i + 1}" disabled>
                </div>
                <div class="col">
                    <input type="number" class="form-control arrival" placeholder="Arrival Time">
                </div>
                <div class="col">
                    <input type="number" class="form-control burst" placeholder="Burst Time">
                </div>
                ${type === 'Priority' ? `
                <div class="col">
                    <input type="number" class="form-control priority" placeholder="Priority">
                </div>` : ''}
            </div>
        `;
    }

    document.getElementById('quantumContainer').style.display = (type === 'RR') ? 'block' : 'none';
}

function runScheduling() {
    const type = document.getElementById('schedulingType').value;
    const arrival = Array.from(document.querySelectorAll('.arrival')).map(el => Number(el.value));
    const burst = Array.from(document.querySelectorAll('.burst')).map(el => Number(el.value));
    const priority = Array.from(document.querySelectorAll('.priority')).map(el => Number(el?.value) || 0);
    const quantum = Number(document.getElementById('timeQuantum')?.value) || 0;

    let result;

    switch (type) {
        case 'FCFS':
            result = fcfs(arrival, burst);
            break;
        case 'SJF':
            result = sjf(arrival, burst);
            break;
        case 'Priority':
            result = priorityScheduling(arrival, burst, priority);
            break;
        case 'RR':
            if (!quantum || quantum <= 0) {
                alert('Please enter a valid time quantum.');
                return;
            }
            result = roundRobin(arrival, burst, quantum);
            break;
    }

    renderGanttChart(result.timeline);
    renderTable(result.processes);
}

function fcfs(arrival, burst) {
    const n = arrival.length;
    const processes = arrival.map((at, i) => ({
        id: i,
        arrival: at,
        burst: burst[i],
        start: 0,
        finish: 0,
        waiting: 0,
        turnaround: 0,
    }));

    processes.sort((a, b) => a.arrival - b.arrival);

    let currentTime = 0;
    const timeline = [];

    for (let p of processes) {
        if (currentTime < p.arrival) currentTime = p.arrival;
        p.start = currentTime;
        p.finish = p.start + p.burst;
        p.waiting = p.start - p.arrival;
        p.turnaround = p.finish - p.arrival;
        currentTime = p.finish;

        timeline.push({ id: `P${p.id + 1}`, start: p.start, end: p.finish });
    }

    return { processes, timeline };
}

function sjf(arrival, burst) {
    const n = arrival.length;
    const remaining = [...burst];
    const done = Array(n).fill(false);
    const processes = [];
    const timeline = [];

    let currentTime = 0, completed = 0;

    while (completed < n) {
        let idx = -1;
        let minBurst = Infinity;

        for (let i = 0; i < n; i++) {
            if (!done[i] && arrival[i] <= currentTime && burst[i] < minBurst) {
                minBurst = burst[i];
                idx = i;
            }
        }

        if (idx === -1) {
            currentTime++;
            continue;
        }

        const start = currentTime;
        const finish = currentTime + burst[idx];
        const waiting = start - arrival[idx];
        const turnaround = finish - arrival[idx];

        processes.push({
            id: idx,
            arrival: arrival[idx],
            burst: burst[idx],
            start,
            finish,
            waiting,
            turnaround
        });

        timeline.push({ id: `P${idx + 1}`, start, end: finish });

        currentTime = finish;
        done[idx] = true;
        completed++;
    }

    return { processes, timeline };
}

function priorityScheduling(arrival, burst, priority) {
    const n = arrival.length;
    const processes = arrival.map((at, i) => ({
        id: i,
        arrival: at,
        burst: burst[i],
        priority: priority[i],
        start: 0,
        finish: 0,
        waiting: 0,
        turnaround: 0,
    }));

    let currentTime = 0;
    const timeline = [];
    const completed = [];

    while (completed.length < n) {
        const readyQueue = processes
            .filter(p => !completed.includes(p) && p.arrival <= currentTime)
            .sort((a, b) => a.priority - b.priority || a.arrival - b.arrival);

        if (readyQueue.length === 0) {
            currentTime++;
            continue;
        }

        const p = readyQueue[0];
        p.start = currentTime;
        p.finish = p.start + p.burst;
        p.waiting = p.start - p.arrival;
        p.turnaround = p.finish - p.arrival;
        currentTime = p.finish;

        completed.push(p);
        timeline.push({ id: `P${p.id + 1}`, start: p.start, end: p.finish });
    }

    return { processes: completed.sort((a, b) => a.id - b.id), timeline };
}

function roundRobin(arrival, burst, quantum) {
    const n = arrival.length;
    const remBurst = [...burst];
    const queue = [];
    const timeline = [];
    const processes = Array(n).fill(0).map((_, i) => ({
        id: i,
        arrival: arrival[i],
        burst: burst[i],
        start: -1,
        finish: 0,
        waiting: 0,
        turnaround: 0
    }));

    let currentTime = 0;
    const visited = Array(n).fill(false);

    while (true) {
        let done = true;
        for (let i = 0; i < n; i++) {
            if (arrival[i] <= currentTime && remBurst[i] > 0 && !visited[i]) {
                queue.push(i);
                visited[i] = true;
            }
        }

        if (queue.length === 0) {
            if (remBurst.every(b => b === 0)) break;
            currentTime++;
            continue;
        }

        const i = queue.shift();

        const execTime = Math.min(quantum, remBurst[i]);
        if (processes[i].start === -1) processes[i].start = currentTime;

        timeline.push({ id: `P${i + 1}`, start: currentTime, end: currentTime + execTime });

        currentTime += execTime;
        remBurst[i] -= execTime;

        for (let j = 0; j < n; j++) {
            if (arrival[j] <= currentTime && remBurst[j] > 0 && !visited[j]) {
                queue.push(j);
                visited[j] = true;
            }
        }

        if (remBurst[i] > 0) {
            queue.push(i);
        } else {
            processes[i].finish = currentTime;
            processes[i].turnaround = currentTime - arrival[i];
            processes[i].waiting = processes[i].turnaround - burst[i];
        }
    }

    return { processes, timeline };
}

function renderGanttChart(timeline) {
    const chart = document.getElementById('ganttChart');
    chart.innerHTML = '';

    for (let block of timeline) {
        const div = document.createElement('div');
        div.className = 'gantt-block';
        div.innerHTML = `
            <div>${block.id}</div>
            <div class="time">${block.start} - ${block.end}</div>
        `;
        chart.appendChild(div);
    }
}

function renderTable(processes) {
    const table = document.getElementById('results');
    table.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Process</th>
                    <th>Arrival Time</th>
                    <th>Burst Time</th>
                    <th>Start Time</th>
                    <th>Finish Time</th>
                    <th>Waiting Time</th>
                    <th>Turnaround Time</th>
                </tr>
            </thead>
            <tbody>
                ${processes.map(p => `
                    <tr>
                        <td>P${p.id + 1}</td>
                        <td>${p.arrival}</td>
                        <td>${p.burst}</td>
                        <td>${p.start}</td>
                        <td>${p.finish}</td>
                        <td>${p.waiting}</td>
                        <td>${p.turnaround}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}