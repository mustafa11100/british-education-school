/* =========================================================
   SCHOOL MANAGEMENT SYSTEM
   app.js - Frontend Application
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
   ========================================================= */

const API_BASE = "/api";

/* =========================================================
   STATE
   ========================================================= */

const AppState = {
    user: null,
    school: null,
    token: localStorage.getItem("school_token") || null,
    currentPage: "dashboard",
    loading: false
};

/* =========================================================
   HELPERS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return document.querySelectorAll(selector);
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(date) {
    if (!date) return "-";

    try {
        return new Date(date).toLocaleDateString("ar-EG", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    } catch {
        return date;
    }
}

function formatDateTime(date) {
    if (!date) return "-";

    try {
        return new Date(date).toLocaleString("ar-EG", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch {
        return date;
    }
}

function showLoading(text = "جاري التحميل...") {
    AppState.loading = true;

    let loader = $("#app-loader");

    if (!loader) {
        loader = document.createElement("div");
        loader.id = "app-loader";

        loader.innerHTML = `
            <div class="loader-box">
                <div class="loader-spinner"></div>
                <div>${escapeHTML(text)}</div>
            </div>
        `;

        document.body.appendChild(loader);
    }

    loader.style.display = "flex";
}

function hideLoading() {
    AppState.loading = false;

    const loader = $("#app-loader");

    if (loader) {
        loader.style.display = "none";
    }
}

function notify(message, type = "success") {
    let container = $("#notifications-container");

    if (!container) {
        container = document.createElement("div");
        container.id = "notifications-container";

        document.body.appendChild(container);
    }

    const item = document.createElement("div");

    item.className = `notification notification-${type}`;

    item.innerHTML = `
        <span>${escapeHTML(message)}</span>
        <button type="button" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(item);

    setTimeout(() => {
        if (item.parentElement) {
            item.remove();
        }
    }, 4000);
}

/* =========================================================
   API
   ========================================================= */

async function apiRequest(endpoint, options = {}) {

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (AppState.token) {
        headers.Authorization = `Bearer ${AppState.token}`;
    }

    const config = {
        ...options,
        headers
    };

    try {

        const response = await fetch(`${API_BASE}${endpoint}`, config);

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (response.status === 401) {

            logout(false);

            throw new Error(
                data.message || "انتهت جلسة تسجيل الدخول"
            );
        }

        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                `حدث خطأ (${response.status})`
            );
        }

        return data;

    } catch (error) {

        console.error("API ERROR:", error);

        throw error;
    }
}

/* =========================================================
   AUTH
   ========================================================= */

async function login(username, password) {

    if (!username || !password) {
        notify("أدخل اسم المستخدم وكلمة المرور", "error");
        return false;
    }

    showLoading("جاري تسجيل الدخول...");

    try {

        const data = await apiRequest("/login", {
            method: "POST",
            body: JSON.stringify({
                username,
                password
            })
        });

        if (!data.success && !data.token && !data.user) {
            throw new Error(
                data.message || "بيانات الدخول غير صحيحة"
            );
        }

        if (data.token) {
            AppState.token = data.token;
            localStorage.setItem(
                "school_token",
                data.token
            );
        }

        if (data.user) {
            AppState.user = data.user;
            localStorage.setItem(
                "school_user",
                JSON.stringify(data.user)
            );
        }

        if (data.school) {
            AppState.school = data.school;
            localStorage.setItem(
                "school_data",
                JSON.stringify(data.school)
            );
        }

        notify("تم تسجيل الدخول بنجاح");

        await loadDashboard();

        return true;

    } catch (error) {

        notify(
            error.message || "فشل تسجيل الدخول",
            "error"
        );

        return false;

    } finally {

        hideLoading();
    }
}

function restoreSession() {

    try {

        const user = localStorage.getItem("school_user");
        const school = localStorage.getItem("school_data");

        if (user) {
            AppState.user = JSON.parse(user);
        }

        if (school) {
            AppState.school = JSON.parse(school);
        }

    } catch {

        localStorage.removeItem("school_user");
        localStorage.removeItem("school_data");
    }
}

async function checkSession() {

    restoreSession();

    if (!AppState.token) {
        showLoginScreen();
        return false;
    }

    try {

        const data = await apiRequest("/me");

        if (data.user) {
            AppState.user = data.user;

            localStorage.setItem(
                "school_user",
                JSON.stringify(data.user)
            );
        }

        if (data.school) {
            AppState.school = data.school;

            localStorage.setItem(
                "school_data",
                JSON.stringify(data.school)
            );
        }

        await loadDashboard();

        return true;

    } catch {

        showLoginScreen();

        return false;
    }
}

function logout(showMessage = true) {

    AppState.token = null;
    AppState.user = null;
    AppState.school = null;

    localStorage.removeItem("school_token");
    localStorage.removeItem("school_user");
    localStorage.removeItem("school_data");

    if (showMessage) {
        notify("تم تسجيل الخروج");
    }

    showLoginScreen();
}

/* =========================================================
   LOGIN SCREEN
   ========================================================= */

function showLoginScreen() {

    const login = $("#login-screen");
    const app = $("#app");

    if (login) {
        login.style.display = "flex";
    }

    if (app) {
        app.style.display = "none";
    }
}

function showAppScreen() {

    const login = $("#login-screen");
    const app = $("#app");

    if (login) {
        login.style.display = "none";
    }

    if (app) {
        app.style.display = "block";
    }
}

/* =========================================================
   USER INFO
   ========================================================= */

function getRole() {

    if (!AppState.user) {
        return null;
    }

    return (
        AppState.user.role ||
        AppState.user.user_role ||
        null
    );
}

function roleName(role) {

    const roles = {
        owner: "مالك النظام",
        school_admin: "مدير المدرسة",
        teacher: "معلم",
        hr: "الموارد البشرية",
        accountant: "محاسب",
        employee: "موظف",
        parent: "ولي أمر",
        student: "طالب"
    };

    return roles[role] || role || "مستخدم";
}

function isOwner() {
    return getRole() === "owner";
}

function isSchoolAdmin() {
    return getRole() === "school_admin";
}

function canManageUsers() {

    return [
        "owner",
        "school_admin"
    ].includes(getRole());
}

function canManageSchool() {

    return [
        "owner",
        "school_admin"
    ].includes(getRole());
}

/* =========================================================
   USER INTERFACE
   ========================================================= */

function updateUserInterface() {

    if (!AppState.user) return;

    const name =
        AppState.user.name ||
        AppState.user.username ||
        "المستخدم";

    const role = roleName(getRole());

    $$("#user-name").forEach(el => {
        el.textContent = name;
    });

    $$("#user-role").forEach(el => {
        el.textContent = role;
    });

    $$("#school-name").forEach(el => {

        el.textContent =
            AppState.school?.name ||
            (isOwner() ? "لوحة مالك النظام" : "المدرسة");
    });

    applyPermissions();
}

function applyPermissions() {

    $$("[data-role]").forEach(element => {

        const allowedRoles =
            element
                .getAttribute("data-role")
                .split(",")
                .map(x => x.trim());

        const role = getRole();

        element.style.display =
            allowedRoles.includes(role)
                ? ""
                : "none";
    });
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function navigate(page) {

    AppState.currentPage = page;

    $$("[data-page]").forEach(item => {

        item.classList.toggle(
            "active",
            item.getAttribute("data-page") === page
        );
    });

    const sections = $$("[data-section]");

    sections.forEach(section => {

        section.style.display =
            section.getAttribute("data-section") === page
                ? ""
                : "none";
    });

    loadPageData(page);
}

async function loadPageData(page) {

    try {

        switch (page) {

            case "dashboard":
                await loadDashboard();
                break;

            case "users":
                await loadUsers();
                break;

            case "schools":
                await loadSchools();
                break;

            case "students":
                await loadStudents();
                break;

            case "employees":
                await loadEmployees();
                break;

            case "attendance":
                await loadAttendance();
                break;

            case "notes":
                await loadNotes();
                break;

            case "lessons":
                await loadLessons();
                break;

            case "requests":
                await loadRequests();
                break;

            case "announcements":
                await loadAnnouncements();
                break;

            case "audit":
                await loadAuditLogs();
                break;

        }

    } catch (error) {

        console.error(error);

        notify(
            error.message || "تعذر تحميل البيانات",
            "error"
        );
    }
}

/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {

    showAppScreen();
    updateUserInterface();

    try {

        const data = await apiRequest("/dashboard");

        renderDashboard(data);

    } catch (error) {

        console.error("Dashboard:", error);

        renderDashboard({});
    }
}

function renderDashboard(data) {

    const dashboard = data.dashboard || data || {};

    setText(
        "#total-users",
        dashboard.totalUsers ?? dashboard.users ?? 0
    );

    setText(
        "#total-students",
        dashboard.totalStudents ?? dashboard.students ?? 0
    );

    setText(
        "#total-employees",
        dashboard.totalEmployees ?? dashboard.employees ?? 0
    );

    setText(
        "#online-users",
        dashboard.onlineUsers ?? dashboard.online ?? 0
    );

    setText(
        "#present-today",
        dashboard.presentToday ?? dashboard.present ?? 0
    );

    setText(
        "#absent-today",
        dashboard.absentToday ?? dashboard.absent ?? 0
    );

    setText(
        "#late-today",
        dashboard.lateToday ?? dashboard.late ?? 0
    );

    renderRecentActivities(
        dashboard.recentActivities ||
        dashboard.activities ||
        []
    );
}

function renderRecentActivities(items) {

    const container =
        $("#recent-activities");

    if (!container) return;

    if (!items.length) {

        container.innerHTML = `
            <div class="empty-state">
                لا توجد عمليات حديثة
            </div>
        `;

        return;
    }

    container.innerHTML = items.map(item => {

        return `
            <div class="activity-item">

                <div>
                    <strong>
                        ${escapeHTML(
                            item.action ||
                            item.title ||
                            "عملية"
                        )}
                    </strong>

                    <div>
                        ${escapeHTML(
                            item.details ||
                            item.description ||
                            ""
                        )}
                    </div>
                </div>

                <small>
                    ${formatDateTime(
                        item.created_at ||
                        item.createdAt ||
                        item.date
                    )}
                </small>

            </div>
        `;

    }).join("");
}

/* =========================================================
   USERS
   ========================================================= */

async function loadUsers() {

    if (!canManageUsers()) {
        notify("ليس لديك صلاحية إدارة المستخدمين", "error");
        return;
    }

    const data =
        await apiRequest("/users");

    renderUsers(
        data.users ||
        data.data ||
        []
    );
}

function renderUsers(users) {

    const tbody =
        $("#users-table-body");

    if (!tbody) return;

    if (!users.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="10">
                    لا يوجد مستخدمون
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = users.map(user => {

        const online =
            user.online === true ||
            (
                user.last_seen &&
                Date.now() -
                new Date(user.last_seen).getTime()
                < 5 * 60 * 1000
            );

        return `
            <tr>

                <td>${user.id}</td>

                <td>
                    ${escapeHTML(user.name)}
                </td>

                <td>
                    ${escapeHTML(user.username)}
                </td>

                <td>
                    ${escapeHTML(
                        roleName(user.role)
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        user.email || "-"
                    )}
                </td>

                <td>
                    ${user.active
                        ? '<span class="status-active">نشط</span>'
                        : '<span class="status-disabled">موقوف</span>'
                    }
                </td>

                <td>
                    ${online
                        ? '<span class="online">متصل الآن</span>'
                        : '<span class="offline">غير متصل</span>'
                    }
                </td>

                <td>
                    ${formatDateTime(
                        user.last_seen
                    )}
                </td>

                <td>

                    <button
                        type="button"
                        onclick="editUser(${user.id})">
                        تعديل
                    </button>

                    <button
                        type="button"
                        onclick="toggleUser(${user.id}, ${user.active ? 0 : 1})">
                        ${user.active
                            ? "إيقاف"
                            : "تفعيل"
                        }
                    </button>

                    <button
                        type="button"
                        onclick="changeUserPassword(${user.id})">
                        كلمة المرور
                    </button>

                    <button
                        type="button"
                        onclick="deleteUser(${user.id})">
                        حذف
                    </button>

                </td>

            </tr>
        `;

    }).join("");
}

async function createUser(userData) {

    if (!canManageUsers()) {
        notify("ليس لديك صلاحية", "error");
        return;
    }

    showLoading("جاري إضافة المستخدم...");

    try {

        await apiRequest("/users", {
            method: "POST",
            body: JSON.stringify(userData)
        });

        notify("تمت إضافة المستخدم بنجاح");

        await loadUsers();

    } catch (error) {

        notify(error.message, "error");

    } finally {

        hideLoading();
    }
}

async function editUser(id, userData = null) {

    if (!canManageUsers()) return;

    if (!userData) {

        try {

            const data =
                await apiRequest(`/users/${id}`);

            userData =
                data.user ||
                data.data;

        } catch (error) {

            notify(error.message, "error");
            return;
        }
    }

    const event =
        new CustomEvent("edit-user", {
            detail: userData
        });

    document.dispatchEvent(event);
}

async function toggleUser(id, active) {

    if (!canManageUsers()) return;

    try {

        await apiRequest(
            `/users/${id}/status`,
            {
                method: "PUT",
                body: JSON.stringify({
                    active: Boolean(active)
                })
            }
        );

        notify(
            active
                ? "تم تفعيل المستخدم"
                : "تم إيقاف المستخدم"
        );

        await loadUsers();

    } catch (error) {

        notify(error.message, "error");
    }
}

async function changeUserPassword(id) {

    if (!canManageUsers()) return;

    const password =
        prompt("أدخل كلمة المرور الجديدة:");

    if (!password) return;

    if (password.length < 4) {

        notify(
            "كلمة المرور يجب أن تكون 4 أحرف على الأقل",
            "error"
        );

        return;
    }

    try {

        await apiRequest(
            `/users/${id}/password`,
            {
                method: "PUT",
                body: JSON.stringify({
                    password
                })
            }
        );

        notify(
            "تم تغيير كلمة المرور بنجاح"
        );

    } catch (error) {

        notify(error.message, "error");
    }
}

async function deleteUser(id) {

    if (!canManageUsers()) return;

    if (
        !confirm(
            "هل أنت متأكد من حذف هذا المستخدم؟"
        )
    ) {
        return;
    }

    try {

        await apiRequest(
            `/users/${id}`,
            {
                method: "DELETE"
            }
        );

        notify("تم حذف المستخدم");

        await loadUsers();

    } catch (error) {

        notify(error.message, "error");
    }
}

/* =========================================================
   SCHOOLS
   ========================================================= */

async function loadSchools() {

    if (!isOwner()) {
        notify(
            "إدارة المدارس متاحة لمالك النظام فقط",
            "error"
        );

        return;
    }

    const data =
        await apiRequest("/schools");

    renderSchools(
        data.schools ||
        data.data ||
        []
    );
}

function renderSchools(schools) {

    const tbody =
        $("#schools-table-body");

    if (!tbody) return;

    tbody.innerHTML =
        schools.length
            ? schools.map(school => `
                <tr>

                    <td>${school.id}</td>

                    <td>
                        ${escapeHTML(school.name)}
                    </td>

                    <td>
                        ${escapeHTML(
                            school.code || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            school.email || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            school.phone || "-"
                        )}
                    </td>

                    <td>
                        ${school.status === "active"
                            ? '<span class="status-active">نشطة</span>'
                            : '<span class="status-disabled">موقوفة</span>'
                        }
                    </td>

                    <td>
                        ${escapeHTML(
                            school.subscription_status ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${formatDate(
                            school.subscription_end
                        )}
                    </td>

                    <td>
                        <button
                            onclick="toggleSchool(${school.id})">
                            ${school.status === "active"
                                ? "إيقاف"
                                : "تفعيل"
                            }
                        </button>
                    </td>

                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="9">
                        لا توجد مدارس
                    </td>
                </tr>
            `;
}

async function toggleSchool(id) {

    if (!isOwner()) return;

    try {

        await apiRequest(
            `/schools/${id}/status`,
            {
                method: "PUT"
            }
        );

        notify(
            "تم تحديث حالة المدرسة"
        );

        await loadSchools();

    } catch (error) {

        notify(error.message, "error");
    }
}

/* =========================================================
   STUDENTS
   ========================================================= */

async function loadStudents() {

    const data =
        await apiRequest("/students");

    renderStudents(
        data.students ||
        data.data ||
        []
    );
}

function renderStudents(students) {

    const tbody =
        $("#students-table-body");

    if (!tbody) return;

    tbody.innerHTML =
        students.length
            ? students.map(student => `
                <tr>

                    <td>
                        ${student.id}
                    </td>

                    <td>
                        ${escapeHTML(
                            student.student_number || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            student.name
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            student.class_name || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            student.parent_phone || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            student.status || "-"
                        )}
                    </td>

                    <td>
                        ${formatDate(
                            student.created_at
                        )}
                    </td>

                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="7">
                        لا يوجد طلاب
                    </td>
                </tr>
            `;
}

/* =========================================================
   EMPLOYEES
   ========================================================= */

async function loadEmployees() {

    const data =
        await apiRequest("/employees");

    renderEmployees(
        data.employees ||
        data.data ||
        []
    );
}

function renderEmployees(employees) {

    const tbody =
        $("#employees-table-body");

    if (!tbody) return;

    tbody.innerHTML =
        employees.length
            ? employees.map(employee => `
                <tr>

                    <td>
                        ${employee.id}
                    </td>

                    <td>
                        ${escapeHTML(
                            employee.name
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            employee.job_title ||
                            employee.position ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            employee.department ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            employee.phone ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${formatDate(
                            employee.hire_date ||
                            employee.created_at
                        )}
                    </td>

                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="6">
                        لا يوجد موظفون
                    </td>
                </tr>
            `;
}

/* =========================================================
   ATTENDANCE
   ========================================================= */

async function loadAttendance() {

    const data =
        await apiRequest("/attendance");

    renderAttendance(
        data.attendance ||
        data.data ||
        []
    );
}

function renderAttendance(items) {

    const tbody =
        $("#attendance-table-body");

    if (!tbody) return;

    tbody.innerHTML =
        items.length
            ? items.map(item => `
                <tr>

                    <td>
                        ${escapeHTML(
                            item.name ||
                            item.student_name ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            item.status ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${item.check_in || "-"}
                    </td>

                    <td>
                        ${item.check_out || "-"}
                    </td>

                    <td>
                        ${formatDate(
                            item.date
                        )}
                    </td>

                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="5">
                        لا توجد بيانات حضور
                    </td>
                </tr>
            `;
}

/* =========================================================
   NOTES
   ========================================================= */

async function loadNotes() {

    const data =
        await apiRequest("/notes");

    renderNotes(
        data.notes ||
        data.data ||
        []
    );
}

function renderNotes(notes) {

    const container =
        $("#notes-list");

    if (!container) return;

    if (!notes.length) {

        container.innerHTML = `
            <div class="empty-state">
                لا توجد ملاحظات
            </div>
        `;

        return;
    }

    container.innerHTML =
        notes.map(note => `
            <div class="note-card">

                <h4>
                    ${escapeHTML(
                        note.title ||
                        note.type ||
                        "ملاحظة"
                    )}
                </h4>

                <p>
                    ${escapeHTML(
                        note.content ||
                        note.note ||
                        ""
                    )}
                </p>

                <small>
                    ${formatDateTime(
                        note.created_at
                    )}
                </small>

            </div>
        `).join("");
}

/* =========================================================
   LESSONS
   ========================================================= */

async function loadLessons() {

    const data =
        await apiRequest("/lessons");

    renderLessons(
        data.lessons ||
        data.data ||
        []
    );
}

function renderLessons(lessons) {

    const container =
        $("#lessons-list");

    if (!container) return;

    if (!lessons.length) {

        container.innerHTML = `
            <div class="empty-state">
                لا توجد حصص منشورة
            </div>
        `;

        return;
    }

    container.innerHTML =
        lessons.map(lesson => `
            <div class="lesson-card">

                <h3>
                    ${escapeHTML(
                        lesson.title ||
                        lesson.name ||
                        "حصة"
                    )}
                </h3>

                <p>
                    المادة:
                    ${escapeHTML(
                        lesson.subject || "-"
                    )}
                </p>

                <p>
                    المعلم:
                    ${escapeHTML(
                        lesson.teacher_name || "-"
                    )}
                </p>

                ${
                    lesson.video_url
                        ? `
                            <a
                                href="${escapeHTML(
                                    lesson.video_url
                                )}"
                                target="_blank">
                                مشاهدة الفيديو
                            </a>
                        `
                        : ""
                }

            </div>
        `).join("");
}

/* =========================================================
   REQUESTS
   ========================================================= */

async function loadRequests() {

    const data =
        await apiRequest("/requests");

    renderRequests(
        data.requests ||
        data.data ||
        []
    );
}

function renderRequests(requests) {

    const tbody =
        $("#requests-table-body");

    if (!tbody) return;

    tbody.innerHTML =
        requests.length
            ? requests.map(request => `
                <tr>

                    <td>
                        ${request.id}
                    </td>

                    <td>
                        ${escapeHTML(
                            request.type || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            request.title || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            request.status || "-"
                        )}
                    </td>

                    <td>
                        ${formatDateTime(
                            request.created_at
                        )}
                    </td>

                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="5">
                        لا توجد طلبات
                    </td>
                </tr>
            `;
}

/* =========================================================
   ANNOUNCEMENTS
   ========================================================= */

async function loadAnnouncements() {

    const data =
        await apiRequest("/announcements");

    renderAnnouncements(
        data.announcements ||
        data.data ||
        []
    );
}

function renderAnnouncements(items) {

    const container =
        $("#announcements-list");

    if (!container) return;

    if (!items.length) {

        container.innerHTML = `
            <div class="empty-state">
                لا توجد تعاميم
            </div>
        `;

        return;
    }

    container.innerHTML =
        items.map(item => `
            <div class="announcement-card">

                <h3>
                    ${escapeHTML(
                        item.title ||
                        "تعميم"
                    )}
                </h3>

                <p>
                    ${escapeHTML(
                        item.content ||
                        ""
                    )}
                </p>

                <small>
                    ${formatDateTime(
                        item.created_at
                    )}
                </small>

            </div>
        `).join("");
}

/* =========================================================
   AUDIT LOG
   ========================================================= */

async function loadAuditLogs() {

    if (!isOwner() && !isSchoolAdmin()) {

        notify(
            "ليس لديك صلاحية عرض سجل العمليات",
            "error"
        );

        return;
    }

    const data =
        await apiRequest("/audit-logs");

    renderAuditLogs(
        data.logs ||
        data.auditLogs ||
        data.data ||
        []
    );
}

function renderAuditLogs(logs) {

    const tbody =
        $("#audit-table-body");

    if (!tbody) return;

    tbody.innerHTML =
        logs.length
            ? logs.map(log => `
                <tr>

                    <td>
                        ${log.id}
                    </td>

                    <td>
                        ${escapeHTML(
                            log.user_name ||
                            log.username ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            log.action ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            log.details ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${formatDateTime(
                            log.created_at
                        )}
                    </td>

                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="5">
                        لا توجد عمليات مسجلة
                    </td>
                </tr>
            `;
}

/* =========================================================
   CHANGE OWN PASSWORD
   ========================================================= */

async function changeMyPassword() {

    const currentPassword =
        prompt("أدخل كلمة المرور الحالية:");

    if (!currentPassword) return;

    const newPassword =
        prompt("أدخل كلمة المرور الجديدة:");

    if (!newPassword) return;

    if (newPassword.length < 4) {

        notify(
            "كلمة المرور يجب أن تكون 4 أحرف على الأقل",
            "error"
        );

        return;
    }

    try {

        await apiRequest(
            "/me/password",
            {
                method: "PUT",
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            }
        );

        notify(
            "تم تغيير كلمة المرور بنجاح"
        );

    } catch (error) {

        notify(error.message, "error");
    }
}

/* =========================================================
   GENERIC TEXT SETTER
   ========================================================= */

function setText(selector, value) {

    const element =
        $(selector);

    if (element) {
        element.textContent =
            value ?? 0;
    }
}

/* =========================================================
   FORM HANDLING
   ========================================================= */

function handleLoginForm() {

    const form =
        $("#login-form");

    if (!form) return;

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const username =
                form.querySelector(
                    '[name="username"]'
                )?.value.trim();

            const password =
                form.querySelector(
                    '[name="password"]'
                )?.value;

            await login(
                username,
                password
            );
        }
    );
}

/* =========================================================
   GLOBAL CLICK EVENTS
   ========================================================= */

function setupNavigation() {

    document.addEventListener(
        "click",
        event => {

            const item =
                event.target.closest(
                    "[data-page]"
                );

            if (!item) return;

            event.preventDefault();

            navigate(
                item.getAttribute("data-page")
            );
        }
    );
}

/* =========================================================
   ONLINE HEARTBEAT
   ========================================================= */

let heartbeatTimer = null;

async function sendHeartbeat() {

    if (!AppState.token) return;

    try {

        await apiRequest(
            "/heartbeat",
            {
                method: "POST"
            }
        );

    } catch (error) {

        console.debug(
            "Heartbeat:",
            error.message
        );
    }
}

function startHeartbeat() {

    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
    }

    sendHeartbeat();

    heartbeatTimer =
        setInterval(
            sendHeartbeat,
            60000
        );
}

/* =========================================================
   AUTO REFRESH
   ========================================================= */

setInterval(
    () => {

        if (
            AppState.token &&
            AppState.currentPage === "users"
        ) {
            loadUsers();
        }

    },
    60000
);

/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.login = login;
window.logout = logout;
window.navigate = navigate;

window.createUser = createUser;
window.editUser = editUser;
window.toggleUser = toggleUser;
window.changeUserPassword = changeUserPassword;
window.deleteUser = deleteUser;

window.toggleSchool = toggleSchool;

window.changeMyPassword =
    changeMyPassword;

window.loadUsers = loadUsers;
window.loadSchools = loadSchools;
window.loadStudents = loadStudents;
window.loadEmployees = loadEmployees;
window.loadAttendance = loadAttendance;
window.loadNotes = loadNotes;
window.loadLessons = loadLessons;
window.loadRequests = loadRequests;
window.loadAnnouncements =
    loadAnnouncements;
window.loadAuditLogs =
    loadAuditLogs;

/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initApp() {

    console.log(
        "School Management System starting..."
    );

    handleLoginForm();
    setupNavigation();

    await checkSession();

    if (AppState.token) {
        startHeartbeat();
    }
}

/* =========================================================
   START
   ========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initApp
    );

} else {

    initApp();
}
