"use strict";

// =====================================================
// School Portal - app.js
// متوافق مع server.js و index.html
// =====================================================

const API = "/api";

let currentUser = null;
let studentsCache = [];
let employeesCache = [];
let usersCache = [];
let notesCache = [];
let videosCache = [];
let currentPage = "dashboard";

// =====================================================
// أدوات مساعدة
// =====================================================

function $(id) {
  return document.getElementById(id);
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

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return value;
  }
}

function todayDate() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function showToast(message, type = "success") {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;

  toast.className = "toast";

  if (type === "error") {
    toast.classList.add("toast-error");
  } else {
    toast.classList.add("toast-success");
  }

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function showLoginMessage(message, type = "error") {
  const box = $("loginMessage");

  if (!box) return;

  box.textContent = message;
  box.className = "message";

  if (type === "success") {
    box.classList.add("success");
  } else {
    box.classList.add("error");
  }
}

async function api(url, options = {}) {
  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  };

  try {
    const response = await fetch(API + url, config);

    let data;

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `خطأ في الاتصال (${response.status})`
      );
    }

    return data;

  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// =====================================================
// Modal
// =====================================================

function openModal(title, html) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = html;
  $("modal").classList.remove("hidden");
}

function closeModal() {
  $("modal").classList.add("hidden");
  $("modalBody").innerHTML = "";
}

$("modalClose")?.addEventListener("click", closeModal);

document.querySelector(".modal-overlay")?.addEventListener(
  "click",
  closeModal
);

// =====================================================
// تسجيل الدخول
// =====================================================

$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = $("username").value.trim();
  const password = $("password").value;

  if (!username || !password) {
    showLoginMessage("أدخل اسم المستخدم وكلمة المرور");
    return;
  }

  const button = event.submitter;

  if (button) {
    button.disabled = true;
    button.textContent = "جاري الدخول...";
  }

  try {
    const user = await api("/login", {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    });

    currentUser = user;

    localStorage.setItem(
      "school_current_user",
      JSON.stringify(user)
    );

    showLoginMessage("تم تسجيل الدخول بنجاح", "success");

    setTimeout(() => {
      enterApplication();
    }, 300);

  } catch (error) {
    showLoginMessage(error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "تسجيل الدخول";
    }
  }
});

// =====================================================
// دخول النظام
// =====================================================

function enterApplication() {
  $("loginPage").classList.add("hidden");
  $("appPage").classList.remove("hidden");

  if ($("currentUserName")) {
    $("currentUserName").textContent =
      currentUser?.name || "المستخدم";
  }

  applyPermissions();

  navigateTo("dashboard");

  loadDashboard();
  startActivity();
}

// =====================================================
// الصلاحيات
// =====================================================

function applyPermissions() {
  if (!currentUser) return;

  const role = currentUser.role;

  const usersButton =
    document.querySelector('[data-page="users"]');

  const employeesButton =
    document.querySelector('[data-page="employees"]');

  const payrollButton =
    document.querySelector('[data-page="payroll"]');

  const logsButton =
    document.querySelector('[data-page="logs"]');

  if (role !== "admin") {
    usersButton?.classList.add("hidden");
    employeesButton?.classList.add("hidden");
    payrollButton?.classList.add("hidden");
    logsButton?.classList.add("hidden");
  }
}

// =====================================================
// تسجيل الخروج
// =====================================================

$("logoutButton")?.addEventListener("click", () => {
  currentUser = null;

  localStorage.removeItem("school_current_user");

  $("appPage").classList.add("hidden");
  $("loginPage").classList.remove("hidden");

  $("username").value = "";
  $("password").value = "";

  showLoginMessage("");
});

// =====================================================
// القائمة الجانبية
// =====================================================

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;

    navigateTo(page);

    if (window.innerWidth <= 900) {
      $("sidebar")?.classList.remove("open");
    }
  });
});

function navigateTo(page) {
  currentPage = page;

  document.querySelectorAll(".page-section").forEach(section => {
    section.classList.add("hidden");
  });

  const target = $(`page-${page}`);

  if (target) {
    target.classList.remove("hidden");
  }

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.remove("active");
  });

  const activeButton =
    document.querySelector(`[data-page="${page}"]`);

  activeButton?.classList.add("active");

  loadPageData(page);
}

// =====================================================
// زر القائمة
// =====================================================

$("menuButton")?.addEventListener("click", () => {
  $("sidebar")?.classList.toggle("open");
});

// =====================================================
// تحميل بيانات الصفحة
// =====================================================

async function loadPageData(page) {
  try {
    switch (page) {
      case "dashboard":
        await loadDashboard();
        break;

      case "users":
        await loadUsers();
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

      case "payroll":
        await loadPayroll();
        break;

      case "notes":
        await loadNotesPage();
        break;

      case "videos":
        await loadVideos();
        break;

      case "logs":
        await loadLogs();
        break;
    }
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
}

// =====================================================
// Dashboard
// =====================================================

async function loadDashboard() {
  try {
    const [users, students, employees, health] =
      await Promise.all([
        api("/users"),
        api("/students"),
        api("/employees"),
        api("/health")
      ]);

    $("statUsers").textContent =
      users.total || 0;

    $("statOnline").textContent =
      users.online_count || 0;

    $("statStudents").textContent =
      students.length || 0;

    $("statEmployees").textContent =
      employees.length || 0;

    $("usersTotal").textContent =
      users.total || 0;

    $("usersActive").textContent =
      users.active_count || 0;

    $("usersOnline").textContent =
      users.online_count || 0;

    if ($("healthStatus")) {
      $("healthStatus").innerHTML = `
        <div class="status-box success">
          🟢 ${escapeHTML(health.message || "النظام يعمل")}
          <br>
          <small>${formatDate(health.time)}</small>
        </div>
      `;
    }

    const onlineUsers =
      (users.users || []).filter(user => user.online);

    if ($("onlineUsersList")) {
      if (!onlineUsers.length) {
        $("onlineUsersList").innerHTML =
          "لا يوجد مستخدمون متصلون الآن";
      } else {
        $("onlineUsersList").innerHTML =
          onlineUsers.map(user => `
            <div class="online-user">
              <span>🟢</span>
              <strong>${escapeHTML(user.name)}</strong>
              <small>
                ${escapeHTML(user.role)}
              </small>
            </div>
          `).join("");
      }
    }

  } catch (error) {
    console.error(error);

    if ($("healthStatus")) {
      $("healthStatus").innerHTML =
        `<span class="error">🔴 تعذر الاتصال بالسيرفر</span>`;
    }

    throw error;
  }
}

$("refreshDashboard")?.addEventListener(
  "click",
  loadDashboard
);

// =====================================================
// Users
// =====================================================

async function loadUsers() {
  const data = await api("/users");

  usersCache = data.users || [];

  $("usersTotal").textContent =
    data.total || 0;

  $("usersActive").textContent =
    data.active_count || 0;

  $("usersOnline").textContent =
    data.online_count || 0;

  const body = $("usersTableBody");

  if (!body) return;

  if (!usersCache.length) {
    body.innerHTML = `
      <tr>
        <td colspan="7">
          لا يوجد مستخدمون
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = usersCache.map((user, index) => `
    <tr>

      <td>${index + 1}</td>

      <td>
        <strong>
          ${escapeHTML(user.username)}
        </strong>
      </td>

      <td>
        ${escapeHTML(user.name)}
      </td>

      <td>
        ${roleName(user.role)}
      </td>

      <td>
        ${
          user.online
            ? `<span class="badge success">متصل</span>`
            : user.active
              ? `<span class="badge">نشط</span>`
              : `<span class="badge danger">موقوف</span>`
        }
      </td>

      <td>
        ${formatDate(user.last_seen)}
      </td>

      <td>

        ${
          user.username !== "admin"
            ? `
              <button
                class="btn btn-small"
                onclick="toggleUser(${user.id}, ${user.active ? "true" : "false"})"
              >
                ${user.active ? "إيقاف" : "تفعيل"}
              </button>

              <button
                class="btn btn-small btn-danger"
                onclick="deleteUser(${user.id})"
              >
                حذف
              </button>
            `
            : `
              <span>المدير الرئيسي</span>
            `
        }

      </td>

    </tr>
  `).join("");
}

function roleName(role) {
  const roles = {
    admin: "مدير",
    teacher: "معلم",
    parent: "ولي أمر",
    student: "طالب"
  };

  return roles[role] || role;
}

window.toggleUser = async function(id, active) {
  try {
    const endpoint =
      active
        ? `/users/${id}/disable`
        : `/users/${id}/enable`;

    await api(endpoint, {
      method: "PATCH"
    });

    showToast(
      active
        ? "تم إيقاف المستخدم"
        : "تم تفعيل المستخدم"
    );

    await loadUsers();

  } catch (error) {
    showToast(error.message, "error");
  }
};

window.deleteUser = async function(id) {
  if (!confirm("هل أنت متأكد من حذف هذا المستخدم؟")) {
    return;
  }

  try {
    await api(`/users/${id}`, {
      method: "DELETE"
    });

    showToast("تم حذف المستخدم");

    await loadUsers();

  } catch (error) {
    showToast(error.message, "error");
  }
};

$("addUserButton")?.addEventListener(
  "click",
  () => {

    openModal(
      "إضافة مستخدم",
      `
        <form id="addUserForm">

          <div class="form-group">
            <label>اسم المستخدم</label>
            <input id="newUsername" required>
          </div>

          <div class="form-group">
            <label>كلمة المرور</label>
            <input
              id="newPassword"
              type="password"
              required
            >
          </div>

          <div class="form-group">
            <label>الاسم</label>
            <input id="newName" required>
          </div>

          <div class="form-group">
            <label>الصلاحية</label>

            <select id="newRole" required>
              <option value="admin">مدير</option>
              <option value="teacher">معلم</option>
              <option value="parent">ولي أمر</option>
              <option value="student">طالب</option>
            </select>
          </div>

          <button
            class="btn btn-primary"
            type="submit"
          >
            حفظ
          </button>

        </form>
      `
    );

    $("addUserForm").addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        try {

          await api("/users", {
            method: "POST",
            body: JSON.stringify({
              username: $("newUsername").value.trim(),
              password: $("newPassword").value,
              name: $("newName").value.trim(),
              role: $("newRole").value
            })
          });

          closeModal();

          showToast("تم إضافة المستخدم");

          await loadUsers();

        } catch (error) {
          showToast(error.message, "error");
        }
      }
    );
  }
);

// =====================================================
// Students
// =====================================================

async function loadStudents() {
  studentsCache = await api("/students");

  const body = $("studentsTableBody");

  if (!body) return;

  if (!studentsCache.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6">
          لا يوجد طلاب
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = studentsCache.map((student, index) => `
    <tr>

      <td>${index + 1}</td>

      <td>
        <strong>
          ${escapeHTML(student.name)}
        </strong>
      </td>

      <td>
        ${escapeHTML(student.class_name || "-")}
      </td>

      <td>
        ${escapeHTML(student.parent_phone || "-")}
      </td>

      <td>
        ${
          student.status === "حاضر"
            ? `<span class="badge success">حاضر</span>`
            : `<span class="badge danger">غائب</span>`
        }
      </td>

      <td>

        <button
          class="btn btn-small"
          onclick="toggleStudentAttendance(${student.id})"
        >
          تغيير الحالة
        </button>

        <button
          class="btn btn-small btn-secondary"
          onclick="showStudentAttendance(${student.id})"
        >
          السجل
        </button>

      </td>

    </tr>
  `).join("");

  fillStudentSelect();
}

function fillStudentSelect() {
  const select = $("noteStudent");

  if (!select) return;

  select.innerHTML = `
    <option value="">
      اختر الطالب
    </option>
  `;

  studentsCache.forEach(student => {
    const option = document.createElement("option");

    option.value = student.id;
    option.textContent =
      `${student.name} - ${student.class_name || ""}`;

    select.appendChild(option);
  });
}

$("addStudentButton")?.addEventListener(
  "click",
  () => {

    openModal(
      "إضافة طالب",
      `
        <form id="addStudentForm">

          <div class="form-group">
            <label>اسم الطالب</label>
            <input id="studentName" required>
          </div>

          <div class="form-group">
            <label>الفصل</label>
            <input id="studentClass" required>
          </div>

          <div class="form-group">
            <label>هاتف ولي الأمر</label>
            <input id="studentPhone">
          </div>

          <button
            type="submit"
            class="btn btn-primary"
          >
            حفظ الطالب
          </button>

        </form>
      `
    );

    $("addStudentForm").addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        try {

          await api("/students", {
            method: "POST",
            body: JSON.stringify({
              name: $("studentName").value.trim(),
              class_name: $("studentClass").value.trim(),
              parent_phone: $("studentPhone").value.trim()
            })
          });

          closeModal();

          showToast("تم إضافة الطالب");

          await loadStudents();

        } catch (error) {
          showToast(error.message, "error");
        }
      }
    );
  }
);

window.toggleStudentAttendance = async function(id) {
  try {

    const result =
      await api(`/students/${id}/status`, {
        method: "PATCH"
      });

    showToast(
      `تم تسجيل الطالب: ${result.status}`
    );

    await loadStudents();

  } catch (error) {
    showToast(error.message, "error");
  }
};

window.showStudentAttendance = async function(id) {
  try {

    const data =
      await api(`/students/${id}/attendance`);

    const student =
      studentsCache.find(x => x.id === Number(id));

    openModal(
      `سجل حضور ${student?.name || ""}`,
      `
        <div class="stats-grid small-stats">

          <div class="stat-card">
            <span>حاضر</span>
            <strong>${data.present}</strong>
          </div>

          <div class="stat-card">
            <span>غائب</span>
            <strong>${data.absent}</strong>
          </div>

          <div class="stat-card">
            <span>النسبة</span>
            <strong>${data.percentage}%</strong>
          </div>

        </div>

        <div class="table-wrapper">

          <table>

            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الحالة</th>
              </tr>
            </thead>

            <tbody>

              ${
                data.records.length
                  ? data.records.map(item => `
                    <tr>
                      <td>${escapeHTML(item.date)}</td>
                      <td>${escapeHTML(item.status)}</td>
                    </tr>
                  `).join("")
                  : `
                    <tr>
                      <td colspan="2">
                        لا يوجد سجل
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>
      `
    );

  } catch (error) {
    showToast(error.message, "error");
  }
};

// =====================================================
// Employees
// =====================================================

async function loadEmployees() {
  employeesCache = await api("/employees");

  const body = $("employeesTableBody");

  if (!body) return;

  if (!employeesCache.length) {
    body.innerHTML = `
      <tr>
        <td colspan="9">
          لا يوجد موظفون
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = employeesCache.map((employee, index) => `
    <tr>

      <td>${index + 1}</td>

      <td>
        ${escapeHTML(employee.employee_number || "-")}
      </td>

      <td>
        <strong>
          ${escapeHTML(employee.name)}
        </strong>
      </td>

      <td>
        ${escapeHTML(employee.job_title || "-")}
      </td>

      <td>
        ${escapeHTML(employee.department || "-")}
      </td>

      <td>
        ${escapeHTML(employee.phone || "-")}
      </td>

      <td>
        ${Number(employee.basic_salary || 0) +
          Number(employee.allowance || 0)}
      </td>

      <td>
        ${
          employee.active
            ? `<span class="badge success">نشط</span>`
            : `<span class="badge danger">موقوف</span>`
        }
      </td>

      <td>

        <button
          class="btn btn-small"
          onclick="showEmployeeAttendance(${employee.id})"
        >
          الحضور
        </button>

        <button
          class="btn btn-small btn-secondary"
          onclick="showEmployeePayroll(${employee.id})"
        >
          الراتب
        </button>

      </td>

    </tr>
  `).join("");
}

$("addEmployeeButton")?.addEventListener(
  "click",
  () => {

    openModal(
      "إضافة موظف",
      `
        <form id="addEmployeeForm">

          <div class="form-group">
            <label>رقم الموظف</label>
            <input id="employeeNumber">
          </div>

          <div class="form-group">
            <label>اسم الموظف</label>
            <input id="employeeName" required>
          </div>

          <div class="form-group">
            <label>الوظيفة</label>
            <input id="employeeJob">
          </div>

          <div class="form-group">
            <label>القسم</label>
            <input id="employeeDepartment">
          </div>

          <div class="form-group">
            <label>الهاتف</label>
            <input id="employeePhone">
          </div>

          <div class="form-group">
            <label>تاريخ التعيين</label>
            <input
              id="employeeHireDate"
              type="date"
            >
          </div>

          <div class="form-group">
            <label>الراتب الأساسي</label>
            <input
              id="employeeSalary"
              type="number"
              min="0"
              value="0"
            >
          </div>

          <div class="form-group">
            <label>البدلات</label>
            <input
              id="employeeAllowance"
              type="number"
              min="0"
              value="0"
            >
          </div>

          <button
            type="submit"
            class="btn btn-primary"
          >
            حفظ الموظف
          </button>

        </form>
      `
    );

    $("addEmployeeForm").addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        try {

          await api("/employees", {
            method: "POST",
            body: JSON.stringify({
              employee_number:
                $("employeeNumber").value.trim(),

              name:
                $("employeeName").value.trim(),

              job_title:
                $("employeeJob").value.trim(),

              department:
                $("employeeDepartment").value.trim(),

              phone:
                $("employeePhone").value.trim(),

              hire_date:
                $("employeeHireDate").value,

              basic_salary:
                Number($("employeeSalary").value || 0),

              allowance:
                Number($("employeeAllowance").value || 0)
            })
          });

          closeModal();

          showToast("تم إضافة الموظف");

          await loadEmployees();

        } catch (error) {
          showToast(error.message, "error");
        }
      }
    );
  }
);

window.showEmployeeAttendance = async function(id) {
  try {

    const data =
      await api(`/employees/${id}/attendance`);

    const employee =
      employeesCache.find(x => x.id === Number(id));

    openModal(
      `حضور ${employee?.name || ""}`,
      `
        <div class="stats-grid small-stats">

          <div class="stat-card">
            <span>الحضور</span>
            <strong>${data.present}</strong>
          </div>

          <div class="stat-card">
            <span>الغياب</span>
            <strong>${data.absent}</strong>
          </div>

          <div class="stat-card">
            <span>التأخير</span>
            <strong>${data.late}</strong>
          </div>

        </div>

        <div class="table-wrapper">

          <table>

            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الدخول</th>
                <th>الخروج</th>
                <th>الحالة</th>
                <th>التأخير</th>
              </tr>
            </thead>

            <tbody>

              ${
                data.records.length
                  ? data.records.map(item => `
                    <tr>
                      <td>${escapeHTML(item.date)}</td>
                      <td>${escapeHTML(item.check_in || "-")}</td>
                      <td>${escapeHTML(item.check_out || "-")}</td>
                      <td>${escapeHTML(item.status)}</td>
                      <td>${item.late_minutes || 0} دقيقة</td>
                    </tr>
                  `).join("")
                  : `
                    <tr>
                      <td colspan="5">
                        لا يوجد سجل
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>
      `
    );

  } catch (error) {
    showToast(error.message, "error");
  }
};

// =====================================================
// Attendance
// =====================================================

async function loadAttendance() {
  await loadStudentAttendance();
  await loadEmployeeAttendance();
}

async function loadStudentAttendance() {
  const students = await api("/students");

  const body = $("attendanceStudentsBody");

  if (!body) return;

  body.innerHTML = students.map(student => `
    <tr>

      <td>
        ${escapeHTML(student.name)}
      </td>

      <td>
        ${escapeHTML(student.class_name || "-")}
      </td>

      <td>
        ${
          student.status === "حاضر"
            ? `<span class="badge success">حاضر</span>`
            : `<span class="badge danger">غائب</span>`
        }
      </td>

      <td>
        <button
          class="btn btn-small"
          onclick="toggleStudentAttendance(${student.id})"
        >
          تغيير
        </button>
      </td>

    </tr>
  `).join("");
}

async function loadEmployeeAttendance() {
  const employees = await api("/employees");

  const body = $("attendanceEmployeesBody");

  if (!body) return;

  body.innerHTML = "";

  for (const employee of employees) {

    try {

      const data =
        await api(`/employees/${employee.id}/attendance`);

      const records = data.records || [];

      if (!records.length) {

        body.innerHTML += `
          <tr>
            <td>${escapeHTML(employee.name)}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
          </tr>
        `;

      } else {

        records.slice(0, 20).forEach(record => {

          body.innerHTML += `
            <tr>

              <td>
                ${escapeHTML(employee.name)}
              </td>

              <td>
                ${escapeHTML(record.date)}
              </td>

              <td>
                ${escapeHTML(record.check_in || "-")}
              </td>

              <td>
                ${escapeHTML(record.check_out || "-")}
              </td>

              <td>
                ${escapeHTML(record.status)}
              </td>

              <td>
                ${record.late_minutes || 0} دقيقة
              </td>

            </tr>
          `;

        });
      }

    } catch (error) {
      console.error(error);
    }
  }
}

document.querySelectorAll(".attendance-tab")
  .forEach(tab => {

    tab.addEventListener("click", () => {

      document.querySelectorAll(".attendance-tab")
        .forEach(x => x.classList.remove("active"));

      tab.classList.add("active");

      const type =
        tab.dataset.attendanceType;

      if (type === "students") {

        $("studentAttendancePanel")
          ?.classList.remove("hidden");

        $("employeeAttendancePanel")
          ?.classList.add("hidden");

      } else {

        $("studentAttendancePanel")
          ?.classList.add("hidden");

        $("employeeAttendancePanel")
          ?.classList.remove("hidden");

      }
    });

  });

$("refreshStudentAttendance")?.addEventListener(
  "click",
  loadAttendance
);

// =====================================================
// Payroll
// =====================================================

async function loadPayroll() {
  const employees = await api("/employees");

  const body = $("payrollTableBody");

  if (!body) return;

  if (!employees.length) {

    body.innerHTML = `
      <tr>
        <td colspan="7">
          لا يوجد موظفون
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = "";

  for (const employee of employees) {

    try {

      const payroll =
        await api(
          `/employees/${employee.id}/payroll?month=${encodeURIComponent(currentMonth())}`
        );

      body.innerHTML += `
        <tr>

          <td>
            ${escapeHTML(employee.name)}
          </td>

          <td>
            ${payroll.basic_salary}
          </td>

          <td>
            ${payroll.allowance}
          </td>

          <td>
            ${payroll.bonuses}
          </td>

          <td>
            ${payroll.deductions}
          </td>

          <td>
            <strong>
              ${payroll.net}
            </strong>
          </td>

          <td>

            <button
              class="btn btn-small"
              onclick="showEmployeePayroll(${employee.id})"
            >
              التفاصيل
            </button>

          </td>

        </tr>
      `;

    } catch (error) {

      console.error(error);

      body.innerHTML += `
        <tr>
          <td colspan="7">
            تعذر حساب راتب ${escapeHTML(employee.name)}
          </td>
        </tr>
      `;
    }
  }
}

window.showEmployeePayroll = async function(id) {
  try {

    const payroll =
      await api(
        `/employees/${id}/payroll?month=${encodeURIComponent(currentMonth())}`
      );

    const employee =
      employeesCache.find(x => x.id === Number(id));

    openModal(
      `كشف راتب ${employee?.name || ""}`,
      `
        <div class="payroll-details">

          <p>
            <strong>الشهر:</strong>
            ${escapeHTML(payroll.month)}
          </p>

          <p>
            الراتب الأساسي:
            <strong>${payroll.basic_salary}</strong>
          </p>

          <p>
            البدلات:
            <strong>${payroll.allowance}</strong>
          </p>

          <p>
            المكافآت:
            <strong>${payroll.bonuses}</strong>
          </p>

          <p>
            الخصومات:
            <strong>${payroll.deductions}</strong>
          </p>

          <hr>

          <h3>
            صافي الراتب:
            ${payroll.net}
          </h3>

        </div>
      `
    );

  } catch (error) {
    showToast(error.message, "error");
  }
};

$("payrollSettingsButton")?.addEventListener(
  "click",
  async () => {

    try {

      const settings =
        await api("/payroll-settings");

      openModal(
        "إعدادات الرواتب",
        `
          <form id="payrollSettingsForm">

            <div class="form-group">
              <label>
                خصم الغياب
              </label>

              <input
                id="absenceDeduction"
                type="number"
                min="0"
                value="${settings.absence_deduction || 0}"
              >
            </div>

            <div class="form-group">
              <label>
                خصم التأخير
              </label>

              <input
                id="lateDeduction"
                type="number"
                min="0"
                value="${settings.late_deduction || 0}"
              >
            </div>

            <div class="form-group">
              <label>
                الدقائق المسموحة للتأخير
              </label>

              <input
                id="allowedLate"
                type="number"
                min="0"
                value="${settings.allowed_late_minutes || 0}"
              >
            </div>

            <button
              class="btn btn-primary"
              type="submit"
            >
              حفظ الإعدادات
            </button>

          </form>
        `
      );

      $("payrollSettingsForm")
        .addEventListener(
          "submit",
          async event => {

            event.preventDefault();

            try {

              await api("/payroll-settings", {
                method: "PATCH",
                body: JSON.stringify({

                  absence_deduction:
                    Number($("absenceDeduction").value),

                  late_deduction:
                    Number($("lateDeduction").value),

                  allowed_late_minutes:
                    Number($("allowedLate").value)

                })
              });

              closeModal();

              showToast(
                "تم تحديث إعدادات الرواتب"
              );

              await loadPayroll();

            } catch (error) {
              showToast(error.message, "error");
            }
          }
        );

    } catch (error) {
      showToast(error.message, "error");
    }
  }
);

// =====================================================
// Notes
// =====================================================

async function loadNotesPage() {
  await loadStudents();
  await loadSelectedStudentNotes();
}

async function loadSelectedStudentNotes() {
  const studentId =
    $("noteStudent")?.value;

  const body = $("notesTableBody");

  if (!body) return;

  if (!studentId) {
    body.innerHTML = `
      <tr>
        <td colspan="4">
          اختر طالباً لعرض ملاحظاته
        </td>
      </tr>
    `;
    return;
  }

  try {

    const notes =
      await api(`/notes/${studentId}`);

    notesCache = notes;

    const student =
      studentsCache.find(
        x => x.id === Number(studentId)
      );

    body.innerHTML =
      notes.length
        ? notes.map(note => `
          <tr>

            <td>
              ${escapeHTML(student?.name || "-")}
            </td>

            <td>
              ${escapeHTML(note.text)}
            </td>

            <td>
              ${formatDate(note.created_at)}
            </td>

            <td>
              <button
                class="btn btn-small btn-danger"
                onclick="deleteNote(${note.id})"
              >
                حذف
              </button>
            </td>

          </tr>
        `).join("")
        : `
          <tr>
            <td colspan="4">
              لا توجد ملاحظات
            </td>
          </tr>
        `;

  } catch (error) {
    showToast(error.message, "error");
  }
}

$("noteStudent")?.addEventListener(
  "change",
  loadSelectedStudentNotes
);

$("saveNoteButton")?.addEventListener(
  "click",
  async () => {

    const studentId =
      $("noteStudent").value;

    const text =
      $("noteText").value.trim();

    if (!studentId) {
      showToast("اختر الطالب", "error");
      return;
    }

    if (!text) {
      showToast("اكتب الملاحظة", "error");
      return;
    }

    try {

      await api("/notes", {
        method: "POST",
        body: JSON.stringify({
          student_id: Number(studentId),
          text
        })
      });

      $("noteText").value = "";

      showToast("تم حفظ الملاحظة");

      await loadSelectedStudentNotes();

    } catch (error) {
      showToast(error.message, "error");
    }
  }
);

window.deleteNote = async function(id) {

  if (!confirm("هل تريد حذف هذه الملاحظة؟")) {
    return;
  }

  try {

    await api(`/notes/${id}`, {
      method: "DELETE"
    });

    showToast("تم حذف الملاحظة");

    await loadSelectedStudentNotes();

  } catch (error) {
    showToast(error.message, "error");
  }
};

// =====================================================
// Videos
// =====================================================

async function loadVideos() {
  videosCache = await api("/videos");

  const grid = $("videosGrid");

  if (!grid) return;

  if (!videosCache.length) {

    grid.innerHTML = `
      <div class="card">
        لا توجد حصص أو فيديوهات
      </div>
    `;

    return;
  }

  grid.innerHTML = videosCache.map(video => `
    <div class="card video-card">

      <div class="video-icon">
        🎥
      </div>

      <h3>
        ${escapeHTML(video.title)}
      </h3>

      ${
        video.file_name
          ? `
            <p>
              ${escapeHTML(video.file_name)}
            </p>
          `
          : `
            <p>
              لم يتم تحديد ملف
            </p>
          `
      }

      <small>
        ${formatDate(video.created_at)}
      </small>

    </div>
  `).join("");
}

$("addVideoButton")?.addEventListener(
  "click",
  () => {

    openModal(
      "إضافة حصة",
      `
        <form id="addVideoForm">

          <div class="form-group">

            <label>
              اسم الحصة
            </label>

            <input
              id="videoTitle"
              required
              placeholder="مثال: الرياضيات - الدرس الأول"
            >

          </div>

          <div class="form-group">

            <label>
              اسم الملف أو رابط الفيديو
            </label>

            <input
              id="videoFile"
              placeholder="مثال: lesson1.mp4"
            >

          </div>

          <button
            type="submit"
            class="btn btn-primary"
          >
            حفظ الحصة
          </button>

        </form>
      `
    );

    $("addVideoForm").addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        try {

          await api("/videos", {
            method: "POST",
            body: JSON.stringify({
              title:
                $("videoTitle").value.trim(),

              file_name:
                $("videoFile").value.trim()
            })
          });

          closeModal();

          showToast("تم إضافة الحصة");

          await loadVideos();

        } catch (error) {
          showToast(error.message, "error");
        }
      }
    );
  }
);

// =====================================================
// Logs
// =====================================================

async function loadLogs() {
  const logs =
    await api("/audit-logs");

  const body =
    $("logsTableBody");

  if (!body) return;

  if (!logs.length) {

    body.innerHTML = `
      <tr>
        <td colspan="5">
          لا توجد عمليات
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = logs.map((log, index) => `
    <tr>

      <td>
        ${index + 1}
      </td>

      <td>
        ${escapeHTML(
          log.user_name ||
          log.username ||
          "النظام"
        )}
      </td>

      <td>
        ${escapeHTML(log.action)}
      </td>

      <td>
        ${escapeHTML(log.details || "-")}
      </td>

      <td>
        ${formatDate(log.created_at)}
      </td>

    </tr>
  `).join("");
}

$("refreshLogs")?.addEventListener(
  "click",
  loadLogs
);

// =====================================================
// تحديث النشاط
// =====================================================

let activityTimer = null;

function startActivity() {

  if (!currentUser?.id) return;

  if (activityTimer) {
    clearInterval(activityTimer);
  }

  sendActivity();

  activityTimer = setInterval(
    sendActivity,
    30000
  );
}

async function sendActivity() {

  if (!currentUser?.id) return;

  try {

    const result =
      await api("/activity", {
        method: "POST",
        body: JSON.stringify({
          user_id: currentUser.id
        })
      });

    if ($("onlineIndicator")) {
      $("onlineIndicator").textContent =
        "● متصل";
    }

    if (result?.last_seen) {
      currentUser.last_seen =
        result.last_seen;
    }

  } catch (error) {

    console.error(
      "Activity error:",
      error
    );

    if ($("onlineIndicator")) {
      $("onlineIndicator").textContent =
        "● غير متصل";
    }
  }
}

// =====================================================
// استعادة الجلسة
// =====================================================

async function restoreSession() {

  try {

    const saved =
      localStorage.getItem(
        "school_current_user"
      );

    if (!saved) return;

    const user =
      JSON.parse(saved);

    if (!user?.id) return;

    const users =
      await api("/users");

    const found =
      (users.users || []).find(
        x => x.id === user.id
      );

    if (!found || !found.active) {

      localStorage.removeItem(
        "school_current_user"
      );

      return;
    }

    currentUser = found;

    enterApplication();

  } catch (error) {

    console.error(
      "Session restore error:",
      error
    );

  }
}

// =====================================================
// تحديث دوري للوحة التحكم
// =====================================================

setInterval(() => {

  if (
    currentUser &&
    currentPage === "dashboard"
  ) {
    loadDashboard().catch(
      console.error
    );
  }

}, 30000);

// =====================================================
// بدء التطبيق
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    restoreSession();

  }
);
