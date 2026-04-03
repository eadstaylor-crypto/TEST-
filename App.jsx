import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "bloom_state_v1";
const PASTELS = ["#FFF5BA", "#FFDDEE", "#DFFFE1", "#DDEBFF", "#F0E1FF", "#FFE7C9"];
const RECURRENCE_OPTIONS = [
  { value: "none", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "Every 2 months" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

const isoToday = () => new Date().toISOString().slice(0, 10);
const toDate = (s) => (s ? new Date(`${s}T00:00:00`) : null);
const fmtDate = (s) => {
  if (!s) return "—";
  const d = toDate(s);
  return d?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) ?? "—";
};
const getPriorityTier = (urgency = 1, importance = 1) => {
  const score = Number(urgency) + Number(importance);
  if (score >= 5) return { label: "🔥 Do First", color: "#D4364A", score };
  if (score === 4) return { label: "⚡ Act Soon", color: "#E8943A", score };
  if (score === 3) return { label: "📌 Plan It", color: "#3878D4", score };
  return { label: "💤 When You Can", color: "#7A7A7A", score };
};

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));
const mondayStart = (date) => {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};
const ymd = (d) => d.toISOString().slice(0, 10);
const diffDays = (a, b) => Math.floor((a - b) / (1000 * 60 * 60 * 24));

const recurrenceMatch = (task, dateStr) => {
  const target = toDate(dateStr);
  if (!target) return false;
  const start = toDate(task.dueDate || task.created);
  if (!start) return false;
  const delta = diffDays(target, start);
  if (delta < 0) return false;
  const rec = task.recurrence || "none";
  if (rec === "none") return (task.dueDate || task.created) === dateStr;
  if (rec === "daily") return true;
  if (rec === "weekly") return delta % 7 === 0;
  if (rec === "biweekly") return delta % 14 === 0;
  if (rec === "monthly") return delta % 30 === 0;
  if (rec === "bimonthly") return delta % 60 === 0;
  if (rec === "quarterly") return delta % 91 === 0;
  if (rec === "yearly") return delta % 365 === 0;
  if (rec === "every_X_days") return delta % (task.customEvery || 1) === 0;
  if (rec === "every_X_weeks") return delta % ((task.customEvery || 1) * 7) === 0;
  if (rec === "every_X_months") return delta % ((task.customEvery || 1) * 30) === 0;
  return false;
};

const defaultData = {
  tasks: [],
  protocols: [],
  projects: [],
  rewards: ["Fancy coffee ☕", "20 min guilt-free scroll 📱", "Tiny dance break 💃"],
  notes: [],
};

export default function App() {
  const [appData, setAppData] = useState(defaultData);
  const [view, setView] = useState("home");
  const [homeMode, setHomeMode] = useState("today");
  const [weekAnchor, setWeekAnchor] = useState(isoToday());
  const [monthAnchor, setMonthAnchor] = useState(isoToday());
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const [taskName, setTaskName] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskUrgency, setTaskUrgency] = useState(2);
  const [taskImportance, setTaskImportance] = useState(2);
  const [taskRecurrence, setTaskRecurrence] = useState("none");
  const [taskDueDate, setTaskDueDate] = useState(isoToday());
  const [taskRewardEligible, setTaskRewardEligible] = useState(false);
  const [taskSaveTemplate, setTaskSaveTemplate] = useState(false);
  const [taskCustomEvery, setTaskCustomEvery] = useState(1);
  const [taskCustomUnit, setTaskCustomUnit] = useState("days");

  const [protocolName, setProtocolName] = useState("");
  const [protocolUsePriority, setProtocolUsePriority] = useState(false);
  const [protocolUrgency, setProtocolUrgency] = useState(2);
  const [protocolImportance, setProtocolImportance] = useState(2);
  const [protocolDueDate, setProtocolDueDate] = useState("");
  const [protocolTasks, setProtocolTasks] = useState([{ name: "", notes: "", urgency: 2, importance: 2, dueDate: "" }]);

  const [projectName, setProjectName] = useState("");
  const [projectUsePriority, setProjectUsePriority] = useState(false);
  const [projectUrgency, setProjectUrgency] = useState(2);
  const [projectImportance, setProjectImportance] = useState(2);
  const [projectDueDate, setProjectDueDate] = useState("");
  const [projectSubtasks, setProjectSubtasks] = useState([{ id: crypto.randomUUID(), name: "", completed: false, dueDate: "", addedToTasks: false }]);

  const [rewardInput, setRewardInput] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [noteText, setNoteText] = useState("");
  const [notePinDate, setNotePinDate] = useState("");
  const [pinTargetId, setPinTargetId] = useState(null);
  const [pinTargetDate, setPinTargetDate] = useState("");

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [rewardPopup, setRewardPopup] = useState({ open: false, text: "" });

  const rewardsRef = useRef(appData.rewards);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAppData({ ...defaultData, ...parsed });
      } catch {
        setAppData(defaultData);
      }
    }
  }, []);

  useEffect(() => {
    rewardsRef.current = appData.rewards;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  }, [appData]);

  useEffect(() => {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:wght@600;700&display=swap";
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const today = isoToday();
  const todayTasks = useMemo(() => {
    return appData.tasks
      .filter((t) => recurrenceMatch(t, today))
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return getPriorityTier(b.urgency, b.importance).score - getPriorityTier(a.urgency, a.importance).score;
      });
  }, [appData.tasks, today]);

  const protocolMatches = useMemo(() => {
    if (taskName.trim().length < 2) return [];
    const q = taskName.toLowerCase();
    return appData.protocols.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
  }, [taskName, appData.protocols]);

  const completeTask = useCallback((id) => {
    setAppData((prev) => {
      const next = deepClone(prev);
      const t = next.tasks.find((x) => x.id === id);
      if (!t) return prev;
      t.completed = !t.completed;
      t.completedDate = t.completed ? isoToday() : null;
      if (t.completed && t.rewardEligible && rewardsRef.current.length) {
        setTimeout(() => {
          const pick = rewardsRef.current[Math.floor(Math.random() * rewardsRef.current.length)];
          setRewardPopup({ open: true, text: pick });
          setTimeout(() => setRewardPopup({ open: false, text: "" }), 6000);
        }, 30);
      }
      return next;
    });
  }, []);

  const deleteTask = useCallback((id) => {
    setAppData((prev) => {
      const next = deepClone(prev);
      next.tasks = next.tasks.filter((t) => t.id !== id);
      return next;
    });
    setView("home");
  }, []);

  const addTask = useCallback(() => {
    if (!taskName.trim()) return;
    const recurrence = taskRecurrence === "custom" ? `every_X_${taskCustomUnit}` : taskRecurrence;
    const newTask = {
      id: crypto.randomUUID(),
      name: taskName.trim(),
      notes: taskNotes,
      urgency: taskUrgency,
      importance: taskImportance,
      recurrence,
      customEvery: taskRecurrence === "custom" ? Number(taskCustomEvery || 1) : undefined,
      dueDate: taskRecurrence === "daily" ? "" : taskDueDate,
      rewardEligible: taskRewardEligible,
      completed: false,
      completedDate: null,
      fromProtocol: null,
      fromProject: taskSaveTemplate ? "Template Saved" : null,
      created: isoToday(),
    };
    setAppData((prev) => {
      const next = deepClone(prev);
      next.tasks.push(newTask);
      return next;
    });
    setTaskName("");
    setTaskNotes("");
    setTaskUrgency(2);
    setTaskImportance(2);
    setTaskRecurrence("none");
    setTaskDueDate(isoToday());
    setTaskRewardEligible(false);
    setTaskSaveTemplate(false);
    setTaskCustomEvery(1);
    setTaskCustomUnit("days");
    setView("home");
    setHomeMode("today");
  }, [taskName, taskNotes, taskUrgency, taskImportance, taskRecurrence, taskDueDate, taskRewardEligible, taskSaveTemplate, taskCustomEvery, taskCustomUnit]);

  const activateProtocol = useCallback((protocol, when = today) => {
    setAppData((prev) => {
      const next = deepClone(prev);
      protocol.tasks.forEach((pt) => {
        next.tasks.push({
          id: crypto.randomUUID(),
          name: pt.name,
          notes: pt.notes || "",
          urgency: protocol.usePriority ? (pt.urgency || protocol.urgency || 2) : 2,
          importance: protocol.usePriority ? (pt.importance || protocol.importance || 2) : 2,
          recurrence: "none",
          dueDate: pt.dueDate || when,
          rewardEligible: false,
          completed: false,
          completedDate: null,
          fromProtocol: protocol.name,
          fromProject: null,
          created: isoToday(),
        });
      });
      return next;
    });
  }, [today]);

  const addQuickNote = useCallback(() => {
    if (!quickNote.trim()) return;
    const note = { id: crypto.randomUUID(), text: quickNote.trim(), color: PASTELS[Math.floor(Math.random() * PASTELS.length)], pinDate: "", created: isoToday() };
    setAppData((prev) => {
      const next = deepClone(prev);
      next.notes.unshift(note);
      return next;
    });
    setQuickNote("");
  }, [quickNote]);

  const dayGreeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning, love — your brain can rest.";
    if (h < 18) return "Good afternoon — Bloom's holding your day.";
    return "Good evening — let's close loops gently.";
  }, []);

  const doneToday = todayTasks.filter((t) => t.completed && t.completedDate === today).length;
  const progress = todayTasks.length ? Math.round((doneToday / todayTasks.length) * 100) : 0;

  const selectedTask = appData.tasks.find((t) => t.id === selectedTaskId) || null;

  const weekDays = useMemo(() => {
    const start = mondayStart(toDate(weekAnchor) || new Date());
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekAnchor]);

  const monthCells = useMemo(() => {
    const d = toDate(monthAnchor) || new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const start = mondayStart(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [monthAnchor]);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "linear-gradient(160deg, #FFF9F0 0%, #FDF2F8 40%, #F0F4FF 100%)", paddingBottom: 40 }}>
      <style>{`
        *{box-sizing:border-box;} .card{background:rgba(255,255,255,.82);border:1px solid #f1dfe3;border-radius:14px;box-shadow:0 8px 22px rgba(116,42,52,.08)}
        .btn{border:none;border-radius:12px;padding:10px 14px;font-weight:600;cursor:pointer}
        .btn-main{color:#fff;background:linear-gradient(135deg,#D4364A,#E8943A)}
        .chip{border:1px solid #e3d4da;background:#fff;border-radius:16px;padding:6px 10px;cursor:pointer}
        .tiny{font-size:12px;color:#6b5d63}.nav{position:sticky;top:0;display:flex;align-items:center;gap:10px;padding:10px 16px;background:rgba(255,255,255,.75);backdrop-filter:blur(6px);z-index:10;border-bottom:1px solid #f0e2e7}
        input,textarea,select{width:100%;padding:10px;border:1px solid #e4d9de;border-radius:10px;background:#fffdfd;font-family:inherit}
        .confetti{position:absolute;top:-30px;animation:fall linear forwards}
        @keyframes fall{to{transform:translateY(120vh) rotate(520deg);opacity:.9}}
        @keyframes pop{0%{transform:scale(.75)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
        @keyframes sparkle{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
      `}</style>

      <div className="nav">
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#D4364A", marginRight: 8 }}>✿ Bloom</div>
        {[
          ["home", "Home"],
          ["protocols", "Protocols"],
          ["projects", "Projects"],
          ["rewards", "Rewards"],
        ].map(([k, l]) => <button key={k} className="chip" style={{ background: view === k ? "#ffdfe6" : "#fff" }} onClick={() => setView(k)}>{l}</button>)}
        <button className="chip" onClick={() => setShowResetConfirm(true)}>⟳</button>
      </div>

      <div style={{ maxWidth: 1100, margin: "14px auto", padding: "0 14px" }}>
        {view === "home" && <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>{["today", "week", "month"].map((m) => <button key={m} className="chip" style={{ background: homeMode === m ? "#D4364A", color: homeMode === m ? "#fff" : "#333" }} onClick={() => setHomeMode(m)}>{m[0].toUpperCase() + m.slice(1)}</button>)}</div>
            <button className="btn btn-main" onClick={() => { setView("addTask"); setTaskDueDate(today); }}>+ Add Task</button>
          </div>

          {homeMode === "today" && <>
            <div className="card" style={{ padding: 16, marginBottom: 12, background: "linear-gradient(120deg,#fff,#fff0f4)", borderColor: "#f2c6cf" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 30 }}>{dayGreeting}</div>
              <div className="tiny" style={{ marginBottom: 10 }}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
              <div style={{ height: 10, background: "#f6e9ee", borderRadius: 999 }}><div style={{ height: "100%", width: `${progress}%`, borderRadius: 999, background: "linear-gradient(135deg,#D4364A,#E8943A)" }} /></div>
              <div className="tiny" style={{ marginTop: 8 }}>{progress}% done today — you're doing great.</div>
            </div>

            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <h3 style={{ marginTop: 0 }}>Today’s Tasks</h3>
              {todayTasks.map((t) => {
                const tier = getPriorityTier(t.urgency, t.importance);
                return <div key={t.id} style={{ display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid #f1e7ea", opacity: t.completed ? .6 : 1 }}>
                  <input type="checkbox" checked={t.completed} onChange={() => completeTask(t.id)} style={{ accentColor: tier.color }} />
                  <button className="chip" style={{ textAlign: "left", borderColor: tier.color }} onClick={() => { setSelectedTaskId(t.id); setView("taskDetail"); }}>
                    <div style={{ fontWeight: 700 }}>{t.name} {t.rewardEligible && "🎁"}</div>
                    <div className="tiny">{t.recurrence} · {fmtDate(t.dueDate)} {t.fromProtocol ? `· ${t.fromProtocol}` : ""} {t.fromProject ? `· ${t.fromProject}` : ""}</div>
                  </button>
                  <span className="chip" style={{ borderColor: tier.color }}>{tier.label}</span>
                </div>;
              })}
            </div>

            {!!appData.protocols.length && <div className="card" style={{ padding: 12, marginBottom: 12 }}><div style={{ fontWeight: 700, marginBottom: 8 }}>Quick Protocols</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{appData.protocols.map((p) => <button className="chip" key={p.id} onClick={() => activateProtocol(p)}>{p.name}</button>)}</div></div>}

            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3>On My Mind</h3><button className="chip" onClick={() => setView("notes")}>Manage</button></div>
              <textarea rows={2} placeholder="Type + Enter to add sticky note" value={quickNote} onChange={(e) => setQuickNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addQuickNote(); } }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8, marginTop: 10 }}>
                {appData.notes.filter((n) => !n.pinDate).map((n) => <div key={n.id} style={{ background: n.color, padding: 10, borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,.08)" }}>{n.text}</div>)}
                {appData.notes.filter((n) => n.pinDate === today).map((n) => <div key={n.id} style={{ background: n.color, padding: 10, borderRadius: 10, borderLeft: "4px solid #D4364A" }}>📌 {n.text}</div>)}
              </div>
            </div>
          </>}

          {homeMode === "week" && <div className="card" style={{ padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div><button className="chip" onClick={() => setWeekAnchor(ymd(addDays(toDate(weekAnchor), -7)))}>‹</button> <button className="chip" onClick={() => setWeekAnchor(isoToday())}>This week</button> <button className="chip" onClick={() => setWeekAnchor(ymd(addDays(toDate(weekAnchor), 7)))}>›</button></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginTop: 10 }}>
              {weekDays.map((d) => {
                const ds = ymd(d);
                const list = appData.tasks.filter((t) => recurrenceMatch(t, ds));
                return <div key={ds} className="card" style={{ minHeight: 110, padding: 8, borderColor: ds === today ? "#D4364A" : "#f0e2e7", background: ds === today ? "#fff1f4" : "#fff" }}>
                  <div style={{ fontWeight: ds === today ? 700 : 500 }}>{d.toLocaleDateString(undefined, { weekday: "short" })} {d.getDate()}</div>
                  {list.slice(0, 5).map((t) => <div key={t.id} className="chip" style={{ marginTop: 5, borderColor: getPriorityTier(t.urgency, t.importance).color }} onClick={() => { setSelectedTaskId(t.id); setView("taskDetail"); }}>{t.name}</div>)}
                  <button className="chip" style={{ marginTop: 6 }} onClick={() => { setTaskDueDate(ds); setView("addTask"); }}>+</button>
                </div>;
              })}
            </div>
          </div>}

          {homeMode === "month" && <div className="card" style={{ padding: 10 }}>
            <div><button className="chip" onClick={() => setMonthAnchor(ymd(new Date(toDate(monthAnchor).getFullYear(), toDate(monthAnchor).getMonth() - 1, 1)))}>‹</button> <button className="chip" onClick={() => setMonthAnchor(isoToday())}>This month</button> <button className="chip" onClick={() => setMonthAnchor(ymd(new Date(toDate(monthAnchor).getFullYear(), toDate(monthAnchor).getMonth() + 1, 1)))}>›</button></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginTop: 10 }}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="tiny" style={{ textAlign: "center", fontWeight: 700 }}>{d}</div>)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginTop: 6 }}>
              {monthCells.map((d) => {
                const ds = ymd(d);
                const list = appData.tasks.filter((t) => recurrenceMatch(t, ds));
                return <div key={ds} className="card" style={{ minHeight: 100, padding: 6, background: ds === today ? "#fff1f4" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: ds === today ? 700 : 500 }}>{d.getDate()}</span><button className="chip" style={{ padding: "1px 6px" }} onClick={() => { setTaskDueDate(ds); setView("addTask"); }}>+</button></div>
                  {list.slice(0, 3).map((t) => <div key={t.id} className="tiny" style={{ marginTop: 4, background: "#f8eef1", borderRadius: 8, padding: "2px 5px" }}>{t.name}</div>)}
                  {list.length > 3 && <div className="tiny">+{list.length - 3} more</div>}
                </div>;
              })}
            </div>
          </div>}
        </>}

        {view === "addTask" && <div className="card" style={{ padding: 14 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif" }}>Add Task</h2>
          <label>Task name</label><input value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="What needs to happen?" />
          {!!protocolMatches.length && <div className="card" style={{ marginTop: 6, padding: 8 }}>{protocolMatches.map((p) => <button key={p.id} className="chip" style={{ margin: 4 }} onClick={() => { activateProtocol(p); setView("home"); }}>{p.name}</button>)}</div>}
          <label>Notes</label><textarea rows={3} value={taskNotes} onChange={(e) => setTaskNotes(e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label>Urgency</label><div style={{ display: "flex", gap: 6 }}>{[[1, "Can wait", "#7A7A7A"], [2, "Soon-ish", "#E8943A"], [3, "Right now", "#D4364A"]].map(([n, l, c]) => <button key={n} className="chip" style={{ borderColor: taskUrgency === n ? c : "#ddd", background: taskUrgency === n ? `${c}22` : "#fff" }} onClick={() => setTaskUrgency(n)}><b>{n}</b><div className="tiny">{l}</div></button>)}</div></div>
            <div><label>Importance</label><div style={{ display: "flex", gap: 6 }}>{[[1, "Nice to do", "#7A7A7A"], [2, "Matters", "#3878D4"], [3, "Must happen", "#D4364A"]].map(([n, l, c]) => <button key={n} className="chip" style={{ borderColor: taskImportance === n ? c : "#ddd", background: taskImportance === n ? `${c}22` : "#fff" }} onClick={() => setTaskImportance(n)}><b>{n}</b><div className="tiny">{l}</div></button>)}</div></div>
          </div>
          <div className="chip" style={{ display: "inline-block", marginTop: 8, borderColor: getPriorityTier(taskUrgency, taskImportance).color }}>{getPriorityTier(taskUrgency, taskImportance).label}</div>
          <label style={{ marginTop: 8, display: "block" }}>Recurrence</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{RECURRENCE_OPTIONS.map((o) => <button key={o.value} className="chip" style={{ background: taskRecurrence === o.value ? "#ffdfe6" : "#fff" }} onClick={() => setTaskRecurrence(o.value)}>{o.label}</button>)}</div>
          {taskRecurrence === "custom" && <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, marginTop: 8 }}><input type="number" min={1} value={taskCustomEvery} onChange={(e) => setTaskCustomEvery(e.target.value)} /><select value={taskCustomUnit} onChange={(e) => setTaskCustomUnit(e.target.value)}><option value="days">days</option><option value="weeks">weeks</option><option value="months">months</option></select></div>}
          {taskRecurrence !== "daily" && <><label>Due / Start date</label><input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} /></>}
          <label><input type="checkbox" checked={taskRewardEligible} onChange={(e) => setTaskRewardEligible(e.target.checked)} style={{ width: "auto", marginRight: 8 }} />🎁 Reward eligible</label>
          <label><input type="checkbox" checked={taskSaveTemplate} onChange={(e) => setTaskSaveTemplate(e.target.checked)} style={{ width: "auto", marginRight: 8 }} />💾 Save as template</label>
          <button className="btn btn-main" style={{ marginTop: 10 }} onClick={addTask}>✓ Add Task</button>
        </div>}

        {view === "taskDetail" && selectedTask && <div className="card" style={{ padding: 14 }}>
          <h2 style={{ borderLeft: `6px solid ${getPriorityTier(selectedTask.urgency, selectedTask.importance).color}`, paddingLeft: 8 }}>{selectedTask.name}</h2>
          <div>{selectedTask.notes || "No notes"}</div><div className="tiny">Urgency {selectedTask.urgency} · Importance {selectedTask.importance}</div>
          <div className="tiny">Recurrence: {selectedTask.recurrence} · Due: {fmtDate(selectedTask.dueDate)} · Reward: {selectedTask.rewardEligible ? "Yes" : "No"}</div>
          <div className="tiny">Source: {selectedTask.fromProtocol || selectedTask.fromProject || "Direct"}</div>
          <button className="btn btn-main" onClick={() => completeTask(selectedTask.id)} style={{ marginRight: 8 }}>Complete</button>
          <button className="btn" onClick={() => deleteTask(selectedTask.id)}>Delete</button>
        </div>}

        {view === "protocols" && <div className="card" style={{ padding: 12 }}>
          <h2>Protocols</h2>
          {appData.protocols.map((p) => <div key={p.id} className="card" style={{ padding: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>{p.name} {p.usePriority && <span className="chip">{getPriorityTier(p.urgency, p.importance).label}</span>}</div>
            <div className="tiny">{p.tasks.length} tasks · due {fmtDate(p.dueDate)}</div>
            <button className="chip" onClick={() => activateProtocol(p, today)}>⚡ Today</button> <button className="chip" onClick={() => activateProtocol(p, p.dueDate || today)}>📅 Scheduled</button>
            <button className="chip" onClick={() => setAppData((prev) => ({ ...prev, protocols: prev.protocols.filter((x) => x.id !== p.id) }))}>✕ Delete</button>
          </div>)}
          <h3>Create Protocol</h3>
          <input placeholder="Protocol name" value={protocolName} onChange={(e) => setProtocolName(e.target.value)} />
          <label><input type="checkbox" style={{ width: "auto", marginRight: 8 }} checked={protocolUsePriority} onChange={(e) => setProtocolUsePriority(e.target.checked)} />Set priority</label>
          {protocolUsePriority && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input type="number" min={1} max={3} value={protocolUrgency} onChange={(e) => setProtocolUrgency(Number(e.target.value))} /><input type="number" min={1} max={3} value={protocolImportance} onChange={(e) => setProtocolImportance(Number(e.target.value))} /></div>}
          <input type="date" value={protocolDueDate} onChange={(e) => setProtocolDueDate(e.target.value)} />
          {protocolTasks.map((t, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 130px 64px 64px", gap: 6, marginTop: 6 }}>
            <input placeholder="Task name" value={t.name} onChange={(e) => setProtocolTasks((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
            <input type="date" value={t.dueDate} onChange={(e) => setProtocolTasks((prev) => prev.map((x, idx) => idx === i ? { ...x, dueDate: e.target.value } : x))} />
            {protocolUsePriority && <><input type="number" min={1} max={3} value={t.urgency} onChange={(e) => setProtocolTasks((prev) => prev.map((x, idx) => idx === i ? { ...x, urgency: Number(e.target.value) } : x))} /><input type="number" min={1} max={3} value={t.importance} onChange={(e) => setProtocolTasks((prev) => prev.map((x, idx) => idx === i ? { ...x, importance: Number(e.target.value) } : x))} /></>}
          </div>)}
          <button className="chip" onClick={() => setProtocolTasks((p) => [...p, { name: "", notes: "", urgency: protocolUrgency, importance: protocolImportance, dueDate: "" }])}>+ Task</button>
          <button className="btn btn-main" onClick={() => {
            if (!protocolName.trim()) return;
            setAppData((prev) => ({ ...prev, protocols: [...prev.protocols, { id: crypto.randomUUID(), name: protocolName, urgency: protocolUsePriority ? protocolUrgency : null, importance: protocolUsePriority ? protocolImportance : null, usePriority: protocolUsePriority, dueDate: protocolDueDate, tasks: protocolTasks.filter((t) => t.name.trim()) }] }));
            setProtocolName(""); setProtocolUsePriority(false); setProtocolUrgency(2); setProtocolImportance(2); setProtocolDueDate(""); setProtocolTasks([{ name: "", notes: "", urgency: 2, importance: 2, dueDate: "" }]);
          }}>Save Protocol</button>
        </div>}

        {view === "projects" && <div className="card" style={{ padding: 12 }}>
          <h2>Projects</h2>
          {appData.projects.map((p) => {
            const done = p.subtasks.filter((s) => s.completed).length;
            const pct = p.subtasks.length ? Math.round((done / p.subtasks.length) * 100) : 0;
            return <div key={p.id} className="card" style={{ padding: 10, marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{p.name} {p.usePriority && <span className="chip">{getPriorityTier(p.urgency, p.importance).label}</span>}</div>
              <div style={{ height: 8, background: "#f3e6ea", borderRadius: 99, margin: "6px 0" }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: "linear-gradient(135deg,#D4364A,#E8943A)" }} /></div>
              {p.subtasks.map((s) => <div key={s.id} style={{ display: "grid", gridTemplateColumns: "22px 1fr auto", gap: 8, marginTop: 5 }}>
                <input type="checkbox" checked={s.completed} onChange={() => setAppData((prev) => {
                  const next = deepClone(prev); const proj = next.projects.find((x) => x.id === p.id); const sub = proj?.subtasks.find((x) => x.id === s.id); if (sub) sub.completed = !sub.completed; return next;
                })} />
                <span>{s.name} <span className="tiny">{fmtDate(s.dueDate)}</span></span>
                <button className="chip" disabled={s.addedToTasks} onClick={() => setAppData((prev) => {
                  const next = deepClone(prev);
                  const proj = next.projects.find((x) => x.id === p.id);
                  const sub = proj?.subtasks.find((x) => x.id === s.id);
                  if (!proj || !sub || sub.addedToTasks) return prev;
                  next.tasks.push({ id: crypto.randomUUID(), name: sub.name, notes: "", urgency: proj.usePriority ? proj.urgency || 2 : 2, importance: proj.usePriority ? proj.importance || 2 : 2, recurrence: "none", dueDate: sub.dueDate, rewardEligible: false, completed: false, completedDate: null, fromProtocol: null, fromProject: proj.name, created: isoToday() });
                  sub.addedToTasks = true;
                  return next;
                })}>{s.addedToTasks ? "✓ Added" : "→ Tasks"}</button>
              </div>)}
              <button className="chip" onClick={() => setAppData((prev) => ({ ...prev, projects: prev.projects.filter((x) => x.id !== p.id) }))}>✕ Delete</button>
            </div>;
          })}
          <h3>Create Project</h3>
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" />
          <label><input type="checkbox" style={{ width: "auto", marginRight: 8 }} checked={projectUsePriority} onChange={(e) => setProjectUsePriority(e.target.checked)} />Set priority</label>
          {projectUsePriority && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input type="number" min={1} max={3} value={projectUrgency} onChange={(e) => setProjectUrgency(Number(e.target.value))} /><input type="number" min={1} max={3} value={projectImportance} onChange={(e) => setProjectImportance(Number(e.target.value))} /></div>}
          <input type="date" value={projectDueDate} onChange={(e) => setProjectDueDate(e.target.value)} />
          {projectSubtasks.map((s, i) => <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 8, marginTop: 5 }}><input value={s.name} placeholder="Subtask" onChange={(e) => setProjectSubtasks((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} /><input type="date" value={s.dueDate} onChange={(e) => setProjectSubtasks((prev) => prev.map((x, idx) => idx === i ? { ...x, dueDate: e.target.value } : x))} /></div>)}
          <button className="chip" onClick={() => setProjectSubtasks((p) => [...p, { id: crypto.randomUUID(), name: "", completed: false, dueDate: "", addedToTasks: false }])}>+ Subtask</button>
          <button className="btn btn-main" onClick={() => {
            if (!projectName.trim()) return;
            setAppData((prev) => ({ ...prev, projects: [...prev.projects, { id: crypto.randomUUID(), name: projectName, urgency: projectUsePriority ? projectUrgency : null, importance: projectUsePriority ? projectImportance : null, usePriority: projectUsePriority, dueDate: projectDueDate, subtasks: projectSubtasks.filter((s) => s.name.trim()) }] }));
            setProjectName(""); setProjectUsePriority(false); setProjectUrgency(2); setProjectImportance(2); setProjectDueDate(""); setProjectSubtasks([{ id: crypto.randomUUID(), name: "", completed: false, dueDate: "", addedToTasks: false }]);
          }}>Save Project</button>
        </div>}

        {view === "rewards" && <div className="card" style={{ padding: 12 }}><h2>Rewards</h2>{appData.rewards.map((r, i) => <div key={`${r}-${i}`} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f0e5e9", padding: "8px 0" }}><span>{r}</span><button className="chip" onClick={() => setAppData((p) => ({ ...p, rewards: p.rewards.filter((_, idx) => idx !== i) }))}>Delete</button></div>)}<input value={rewardInput} onChange={(e) => setRewardInput(e.target.value)} placeholder="Add reward" /><button className="btn btn-main" onClick={() => { if (!rewardInput.trim()) return; setAppData((p) => ({ ...p, rewards: [...p.rewards, rewardInput.trim()] })); setRewardInput(""); }}>Add Reward</button></div>}

        {view === "notes" && <div className="card" style={{ padding: 12 }}>
          <h2>Notes Management</h2>
          <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Write note..." />
          <input type="date" value={notePinDate} onChange={(e) => setNotePinDate(e.target.value)} />
          <button className="btn btn-main" onClick={() => {
            if (!noteText.trim()) return;
            setAppData((p) => ({ ...p, notes: [{ id: crypto.randomUUID(), text: noteText.trim(), color: PASTELS[Math.floor(Math.random() * PASTELS.length)], pinDate: notePinDate, created: isoToday() }, ...p.notes] }));
            setNoteText(""); setNotePinDate("");
          }}>Add Note</button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 8, marginTop: 10 }}>
            {appData.notes.map((n) => <div key={n.id} style={{ background: n.color, padding: 10, borderRadius: 10 }}>
              <div>{n.text}</div><div className="tiny">Created {fmtDate(n.created)}</div>{n.pinDate && <div className="tiny">📌 {fmtDate(n.pinDate)}</div>}
              {!n.pinDate && <button className="chip" onClick={() => { setPinTargetId(n.id); setPinTargetDate(isoToday()); }}>Pin</button>}
              {pinTargetId === n.id && <><input type="date" value={pinTargetDate} onChange={(e) => setPinTargetDate(e.target.value)} /><button className="chip" onClick={() => { setAppData((p) => ({ ...p, notes: p.notes.map((x) => x.id === n.id ? { ...x, pinDate: pinTargetDate } : x) })); setPinTargetId(null); }}>Pin</button></>}
              <button className="chip" onClick={() => setAppData((p) => ({ ...p, notes: p.notes.filter((x) => x.id !== n.id) }))}>Delete</button>
            </div>)}
          </div>
        </div>}
      </div>

      {showResetConfirm && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 30 }}>
        <div className="card" style={{ padding: 18, width: 340 }}>
          <h3>Reset Everything?</h3><p className="tiny">This clears all saved Bloom data from localStorage.</p>
          <button className="btn" style={{ background: "#ffd9df", marginRight: 8 }} onClick={() => { localStorage.removeItem(STORAGE_KEY); setAppData(defaultData); setShowResetConfirm(false); }}>Reset</button>
          <button className="btn" onClick={() => setShowResetConfirm(false)}>Cancel</button>
        </div>
      </div>}

      {rewardPopup.open && <div onClick={() => setRewardPopup({ open: false, text: "" })} style={{ position: "fixed", inset: 0, backdropFilter: "blur(5px)", background: "rgba(0,0,0,.34)", zIndex: 50, overflow: "hidden" }}>
        {Array.from({ length: 24 }).map((_, i) => <div key={i} className="confetti" style={{ left: `${Math.random() * 100}%`, width: 8 + Math.random() * 14, height: 8 + Math.random() * 14, background: ["#D4364A", "#E8943A", "#F9C74F", "#90BE6D", "#577590"][i % 5], borderRadius: i % 2 ? "50%" : "2px", animationDuration: `${3 + Math.random() * 3}s`, animationDelay: `${Math.random() * 1.2}s` }} />)}
        <div className="card" style={{ width: 480, maxWidth: "90vw", margin: "12vh auto", padding: 24, textAlign: "center", animation: "pop .55s ease" }}>
          <div style={{ fontSize: 62, animation: "sparkle 1.2s infinite" }}>🎉</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 34 }}>You earned a reward!</div>
          <div style={{ fontSize: 32, color: "#D4364A", fontWeight: 700, marginTop: 8 }}>{rewardPopup.text}</div>
          <div style={{ marginTop: 8 }}>You absolutely deserve this 💛</div>
          <div className="tiny" style={{ marginTop: 12 }}>tap anywhere to close</div>
        </div>
      </div>}
    </div>
  );
}
