import mysql from "../seeders/mysql.js";
import { v4 as uuid } from "uuid";

async function runSeed() {
    const connection = await mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "smarttasker_2_0"
    });

    console.log("Seeding SmartTasker 2.0 Database...");

    // --------------------------
    // 1. USER
    // --------------------------
    const users = [
        { id: uuid(), name: "Admin User", email: "admin@smarttasker.com" },
        { id: uuid(), name: "Manager One", email: "manager1@smarttasker.com" },
        { id: uuid(), name: "Member One", email: "member1@smarttasker.com" }
    ];

    for (const u of users) {
        await connection.execute(
            `INSERT INTO User (user_id, name, email) VALUES (?, ?, ?)`,
            [u.id, u.name, u.email]
        );
    }

    // --------------------------
    // 2. AUTH
    // --------------------------
    const fakeHash = "$2a$10$abcdefghijklmnopqrstuv"; // fake bcrypt hash

    const roles = ["admin", "manager", "member"];
    for (let i = 0; i < users.length; i++) {
        await connection.execute(
            `INSERT INTO Auth (auth_id, user_id, password_hash, role) VALUES (?, ?, ?, ?)`,
            [uuid(), users[i].id, fakeHash, roles[i]]
        );
    }

    // --------------------------
    // 3. PROJECT CATEGORY
    // --------------------------
    const categories = [
        { id: uuid(), name: "Work" },
        { id: uuid(), name: "Personal" },
        { id: uuid(), name: "Shopping" },
        { id: uuid(), name: "Family" }
    ];

    for (const c of categories) {
        await connection.execute(
            `INSERT INTO Project_Category (category_id, name) VALUES (?, ?)`,
            [c.id, c.name]
        );
    }

    // --------------------------
    // 4. PROJECTS
    // --------------------------
    const workId = categories.find(c => c.name === "Work").id;
    const shoppingId = categories.find(c => c.name === "Shopping").id;

    const projects = [
        { id: uuid(), category_id: workId, name: "SmartTasker Backend Development" },
        { id: uuid(), category_id: shoppingId, name: "Shopping Plan" }
    ];

    for (const p of projects) {
        await connection.execute(
            `INSERT INTO Project (project_id, category_id, project_name) VALUES (?, ?, ?)`,
            [p.id, p.category_id, p.name]
        );
    }

    // --------------------------
    // 5. PRIORITY
    // --------------------------
    const priorityList = ["Low", "Medium", "High", "Urgent"];
    const priorities = priorityList.map(name => ({ id: uuid(), name }));

    for (const p of priorities) {
        await connection.execute(
            `INSERT INTO Priority (priority_id, name) VALUES (?, ?)`,
            [p.id, p.name]
        );
    }

    // --------------------------
    // 6. STATUS
    // --------------------------
    const statusList = ["Todo", "In Progress", "Done", "Overdue", "Failed"];
    const statuses = statusList.map(name => ({ id: uuid(), name }));

    for (const s of statuses) {
        await connection.execute(
            `INSERT INTO Status (status_id, name) VALUES (?, ?)`,
            [s.id, s.name]
        );
    }

    // --------------------------
    // 7–8. Due Date & Reminder
    // --------------------------
    const due_dates = [
        { id: uuid(), date: "2025-02-15", time: "14:00:00" },
        { id: uuid(), date: "2025-02-20", time: "09:00:00" }
    ];

    for (const d of due_dates) {
        await connection.execute(
            `INSERT INTO Due_Date (due_date_id, date, time) VALUES (?, ?, ?)`,
            [d.id, d.date, d.time]
        );
    }

    const reminders = [
        { id: uuid(), date: "2025-02-15", time: "13:00:00" },
        { id: uuid(), date: "2025-02-20", time: "08:30:00" }
    ];

    for (const r of reminders) {
        await connection.execute(
            `INSERT INTO Reminder (reminder_id, date, time) VALUES (?, ?, ?)`,
            [r.id, r.date, r.time]
        );
    }

    // --------------------------
    // 9. TASK
    // --------------------------
    const managerId = users.find(u => u.email === "manager1@smarttasker.com").id;
    const sampleTaskId = uuid();

    await connection.execute(
        `INSERT INTO Task (
            task_id, project_id, user_id, title, description,
            priority_id, due_date_id, reminder_id, status_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            sampleTaskId,
            projects[0].id,
            managerId,
            "Thiết kế Database SmartTasker",
            "Tạo ERD, relationship, seed data, foreign keys.",
            priorities.find(p => p.name === "High").id,
            due_dates[0].id,
            reminders[0].id,
            statuses.find(s => s.name === "In Progress").id
        ]
    );

    // --------------------------
    // 10. COLLABORATOR + Task_Collaborator
    // --------------------------
    const collaborators = [
        { id: uuid(), name: "Hương Ly", email: "ly.collab@example.com" },
        { id: uuid(), name: "Lan Anh", email: "lananh.collab@example.com" }
    ];

    for (const c of collaborators) {
        await connection.execute(
            `INSERT INTO Collaborator (collaborator_id, name, email) VALUES (?, ?, ?)`,
            [c.id, c.name, c.email]
        );

        await connection.execute(
            `INSERT INTO Task_Collaborator (task_id, collaborator_id) VALUES (?, ?)`,
            [sampleTaskId, c.id]
        );
    }

    // --------------------------
    // 11. CHANGES
    // --------------------------
    await connection.execute(
        `INSERT INTO Changes (change_id, task_id, user_id, description) VALUES (?, ?, ?, ?)`,
        [uuid(), sampleTaskId, users[0].id, "Khởi tạo task lần đầu."]
    );

    // --------------------------
    // 12. CONVERSATION
    // --------------------------
    await connection.execute(
        `INSERT INTO Conversation (conversation_id, task_id, created_by, message)
         VALUES (?, ?, ?, ?)`,
        [uuid(), sampleTaskId, users[0].id, "Nhớ update tiến độ nhé!"]
    );

    console.log("DONE: Seed data inserted successfully!");
    process.exit(0);
}

runSeed().catch(err => {
    console.error("SEED ERROR:", err);
    process.exit(1);
});
