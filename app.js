"use strict";

/* =====================================================
   BRITISH EDUCATION SCHOOL PORTAL
   APP.JS
===================================================== */

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentPage = "dashboard";

/* =====================================================
   ELEMENTS
===================================================== */

const loginPage = $("loginPage");
const appPage = $("appPage");

const loginBox = $("loginBox");
const registerBox = $("registerBox");

const loginForm = $("loginForm");
const registerForm = $("registerForm");

const loginMessage = $("loginMessage");
const registerMessage = $("registerMessage");

const showRegisterButton = $("showRegisterButton");
const backToLoginButton = $("backToLoginButton");

const logoutButton = $("logoutButton");
const menuButton = $("menuButton");
const sidebar = $("sidebar");

/* =====================================================
   HELPERS
===================================================== */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(element, message, success = false) {
  if (!element) return;

  element.textContent = message;
  element.style.color = success ? "#188038" : "#c62828";
}

function showToast(message, success = true) {
  const toast = $("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;

  toast.style.position = "fixed";
  toast.style.bottom = "25px";
  toast.style.right = "25px";
  toast.style.zIndex = "9999";
  toast.style.padding = "14px 20px";
  toast.style.borderRadius = "10px";
  toast.style.color = "#fff";
  toast.style.background = success ? "#188038" : "#c62828";
  toast.style.boxShadow = "0 5px 20px rgba(0,0,0,.2)";

  toast.classList.remove("hidden");

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      `HTTP ${response.status}`
    );
  }

  return data;
}

function formatDate(date) {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleString("ar-EG");
  } catch {
    return date;
  }
}

function formatMoney(value) {
  const number = Number(value || 0);

  return number.toLocaleString("ar-EG") + " ج.م";
}

/* =====================================================
   LOGIN / REGISTER VIEW
===================================================== */

function showLogin() {
  loginPage.classList.remove("hidden");
  appPage.classList.add("hidden");

  loginBox.classList.remove("hidden");
  registerBox.classList.add("hidden");

  loginMessage.textContent = "";
  registerMessage.textContent = "";
}

function showApp() {
  loginPage.classList.add("hidden");
  appPage.classList.remove("hidden");

  if (currentUser) {
    $("currentUserName").textContent =
      currentUser.name ||
      currentUser.username ||
      "المستخدم";
  }

  loadDashboard();
}

/* =====================================================
   REGISTER
===================================================== */

showRegisterButton?.addEventListener("click", () => {
  loginBox.classList.add("hidden");
  registerBox.classList.remove("hidden");

  loginMessage.textContent = "";
  registerMessage.textContent = "";
});

backToLoginButton?.addEventListener("click", () => {
  registerBox.classList.add("hidden");
  loginBox.classList.remove("hidden");

  registerMessage.textContent = "";
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("registerName").value.trim();
  const username = $("registerUsername").value.trim();
  const password = $("registerPassword").value;
  const confirmPassword = $("registerPasswordConfirm").value;

  if (!name || !username || !password || !confirmPassword) {
    showMessage(
      registerMessage,
      "أكمل جميع البيانات"
    );
    return;
  }

  if (username.length < 3) {
    showMessage(
      registerMessage,
      "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"
    );
    return;
  }

  if (password.length < 4) {
    showMessage(
      registerMessage,
      "كلمة المرور يجب أن تكون 4 أحرف على الأقل"
    );
    return;
  }

  if (password !== confirmPassword) {
    showMessage(
      registerMessage,
      "كلمتا المرور غير متطابقتين"
    );
    return;
  }

  showMessage(
    registerMessage,
    "جاري إنشاء الحساب...",
    true
  );

  try {
    const data = await api("/api/users", {
      method: "POST",
      body: JSON.stringify({
        name,
        username,
        password,
        role: "user"
      })
    });

    showMessage(
      registerMessage,
      data.message || "تم إنشاء الحساب بنجاح ✅",
      true
    );

    registerForm.reset();

    setTimeout(() => {
      registerBox.classList.add("hidden");
      loginBox.classList.remove("hidden");

      $("username").value = username;
      $("password").value = "";

      registerMessage.textContent = "";
    }, 1000);

  } catch (error) {
    console.error(error);

    showMessage(
      registerMessage,
      error.message || "تعذر إنشاء الحساب"
    );
  }
});

/* =====================================================
   LOGIN
===================================================== */

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = $("username").value.trim();
  const password = $("password").value;

  if (!username || !password) {
    showMessage(
      loginMessage,
      "أدخل اسم المستخدم وكلمة المرور"
    );
    return;
  }

  showMessage(
    loginMessage,
    "جاري تسجيل الدخول...",
    true
  );

  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    });

    currentUser =
      data.user ||
      data;

    localStorage.setItem(
      "schoolUser",
      JSON.stringify(currentUser)
    );

    loginForm.reset();

    showToast(
      "تم تسجيل الدخول بنجاح ✅",
      true
    );

    showApp();

  } catch (error) {
    console.error(error);

    showMessage(
      loginMessage,
      error.message || "بيانات الدخول غير صحيحة"
    );
  }
});

/* =====================================================
   LOGOUT
===================================================== */

logoutButton?.addEventListener("click", async () => {

  try {
    await api("/api/logout", {
      method: "POST"
    });
  } catch (error) {
    console.warn(error);
  }

  currentUser = null;

  localStorage.removeItem("schoolUser");

  showLogin();

  showToast(
    "تم تسجيل الخروج",
    true
  );
});

/* =====================================================
   NAVIGATION
===================================================== */

document.querySelectorAll(".nav-item").forEach((button) => {

  button.addEventListener("click", () => {

    const page =
      button.dataset.page;

    openPage(page);

    if (window.innerWidth <= 650) {
      sidebar?.classList.add("hidden");
    }
  });

});

function openPage(page) {

  currentPage = page;

  document
    .querySelectorAll(".page-section")
    .forEach(section => {
      section.classList.add("hidden");
    });

  const selected =
    $(`page-${page}`);

  if (selected) {
    selected.classList.remove("hidden");
  }

  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    });

  switch (page) {

    case "dashboard":
      loadDashboard();
      break;

    case "users":
      loadUsers();
      break;

    case "students":
      loadStudents();
      break;

    case "employees":
      loadEmployees();
      break;

    case "attendance":
      loadAttendance();
      break;

    case "payroll":
      loadPayroll();
      break;

    case "notes":
      loadNotes();
      break;

    case "videos":
      loadVideos();
      break;

    case "logs":
      loadLogs();
      break;
  }
}

menuButton?.addEventListener("click", () => {

  if (!sidebar) return;

  sidebar.classList.toggle("hidden");

});

/* =====================================================
   DASHBOARD
===================================================== */

async function loadDashboard() {

  try {

    const data =
      await api("/api/dashboard");

    $("statUsers").textContent =
      data.users ??
      data.totalUsers ??
      0;

    $("statOnline").textContent =
      data.online ??
      data.onlineUsers ??
      0;

    $("statStudents").textContent =
      data.students ??
      data.totalStudents ??
      0;

    $("statEmployees").textContent =
      data.employees ??
      data.totalEmployees ??
      0;

    if ($("healthStatus")) {

      $("healthStatus").innerHTML = `
        <div style="
          padding:12px;
          background:#edf9f0;
          border-radius:10px;
          color:#188038;
          font-weight:bold;
        ">
          🟢 النظام يعمل بشكل طبيعي
        </div>
      `;
    }

    loadOnlineUsers();

  } catch (error) {

    console.error(error);

    if ($("healthStatus")) {

      $("healthStatus").innerHTML = `
        <div style="
          padding:12px;
          background:#fff1f1;
          border-radius:10px;
          color:#c62828;
        ">
          🔴 تعذر الاتصال بالخادم
        </div>
      `;
    }
  }
}

async function loadOnlineUsers() {

  const container =
    $("onlineUsersList");

  if (!container) return;

  try {

    const data =
      await api("/api/users");

    const users =
      Array.isArray(data)
        ? data
        : data.users || [];

    const onlineUsers =
      users.filter(user =>
        user.online ||
        user.is_online ||
        user.status === "online"
      );

    if (!onlineUsers.length) {

      container.innerHTML =
        "لا يوجد مستخدمون متصلون الآن";

      return;
    }

    container.innerHTML =
      onlineUsers.map(user => `
        <div style="
          padding:10px;
          border-bottom:1px solid #eee;
        ">
          🟢
          <strong>
            ${escapeHTML(user.name || user.username)}
          </strong>
        </div>
      `).join("");

  } catch {

    container.textContent =
      "لا توجد بيانات";
  }
}

$("refreshDashboard")?.addEventListener(
  "click",
  loadDashboard
);

/* =====================================================
   USERS
===================================================== */

async function loadUsers() {

  const tbody =
    $("usersTableBody");

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7">
        جاري تحميل المستخدمين...
      </td>
    </tr>
  `;

  try {

    const data =
      await api("/api/users");

    const users =
      Array.isArray(data)
        ? data
        : data.users || [];

    const activeUsers =
      users.filter(user =>
        user.active !== false &&
        user.status !== "disabled"
      );

    const onlineUsers =
      users.filter(user =>
        user.online ||
        user.is_online ||
        user.status === "online"
      );

    $("usersTotal").textContent =
      users.length;

    $("usersActive").textContent =
      activeUsers.length;

    $("usersOnline").textContent =
      onlineUsers.length;

    if (!users.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            لا يوجد مستخدمون
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      users.map((user, index) => {

        const disabled =
          user.active === false ||
          user.status === "disabled";

        const online =
          user.online ||
          user.is_online ||
          user.status === "online";

        return `
          <tr>

            <td>${index + 1}</td>

            <td>
              ${escapeHTML(user.username)}
            </td>

            <td>
              ${escapeHTML(user.name || "-")}
            </td>

            <td>
              ${escapeHTML(
                user.role === "admin"
                  ? "مدير"
                  : "مستخدم"
              )}
            </td>

            <td>
              <span style="
                display:inline-block;
                padding:5px 10px;
                border-radius:20px;
                background:${disabled ? "#ffebee" : "#e8f5e9"};
                color:${disabled ? "#c62828" : "#188038"};
              ">
                ${disabled ? "موقوف" : "نشط"}
              </span>
            </td>

            <td>
              ${online
                ? "🟢 متصل الآن"
                : escapeHTML(
                    formatDate(
                      user.last_seen ||
                      user.lastSeen
                    )
                  )}
            </td>

            <td>

              ${
                user.role !== "admin"
                  ? `
                    <button
                      class="btn ${disabled ? "btn-primary" : "btn-danger"}"
                      onclick="toggleUser(${Number(user.id)}, ${disabled})"
                    >
                      ${disabled ? "تفعيل" : "إيقاف"}
                    </button>
                  `
                  : `
                    <span style="color:#777">
                      مدير النظام
                    </span>
                  `
              }

            </td>

          </tr>
        `;
      }).join("");

  } catch (error) {

    console.error(error);

    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          تعذر تحميل المستخدمين
        </td>
      </tr>
    `;
  }
}

window.toggleUser = async function(id, activate) {

  try {

    await api(`/api/users/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({
        active: activate
      })
    });

    showToast(
      activate
        ? "تم تفعيل المستخدم"
        : "تم إيقاف المستخدم"
    );

    loadUsers();

  } catch (error) {

    showToast(
      error.message ||
      "تعذر تغيير حالة المستخدم",
      false
    );
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
            <label>الاسم</label>
            <input id="newUserName" required>
          </div>

          <div class="form-group">
            <label>اسم المستخدم</label>
            <input id="newUsername" required>
          </div>

          <div class="form-group">
            <label>كلمة المرور</label>
            <input id="newUserPassword" type="password" required>
          </div>

          <div class="form-group">
            <label>الصلاحية</label>
            <select id="newUserRole">
              <option value="user">مستخدم</option>
              <option value="admin">مدير</option>
            </select>
          </div>

          <button class="btn btn-primary" type="submit">
            حفظ
          </button>

        </form>
      `
    );

    $("addUserForm")?.addEventListener(
      "submit",
      addUser
    );
  }
);

async function addUser(event) {

  event.preventDefault();

  try {

    await api("/api/users", {
      method: "POST",
      body: JSON.stringify({

        name:
          $("newUserName").value.trim(),

        username:
          $("newUsername").value.trim(),

        password:
          $("newUserPassword").value,

        role:
          $("newUserRole").value

      })
    });

    closeModal();

    showToast(
      "تمت إضافة المستخدم بنجاح"
    );

    loadUsers();

  } catch (error) {

    showToast(
      error.message ||
      "تعذر إضافة المستخدم",
      false
    );
  }
}

/* =====================================================
   STUDENTS
===================================================== */

async function loadStudents() {

  const tbody =
    $("studentsTableBody");

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6">
        جاري تحميل الطلاب...
      </td>
    </tr>
  `;

  try {

    const data =
      await api("/api/students");

    const students =
      Array.isArray(data)
        ? data
        : data.students || [];

    if (!students.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            لا يوجد طلاب
          </td>
        </tr>
      `;

      updateStudentSelect([]);
      return;
    }

    tbody.innerHTML =
      students.map((student, index) => `

        <tr>

          <td>${index + 1}</td>

          <td>
            ${escapeHTML(
              student.name ||
              student.student_name ||
              "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              student.class_name ||
              student.class ||
              "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              student.parent_phone ||
              student.phone ||
              "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              student.status ||
              "نشط"
            )}
          </td>

          <td>

            <button
              class="btn btn-danger"
              onclick="deleteStudent(${Number(student.id)})"
            >
              حذف
            </button>

          </td>

        </tr>

      `).join("");

    updateStudentSelect(students);

  } catch (error) {

    console.error(error);

    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          تعذر تحميل الطلاب
        </td>
      </tr>
    `;
  }
}

function updateStudentSelect(students) {

  const select =
    $("noteStudent");

  if (!select) return;

  select.innerHTML = `
    <option value="">
      اختر الطالب
    </option>
  `;

  students.forEach(student => {

    const option =
      document.createElement("option");

    option.value =
      student.id;

    option.textContent =
      student.name ||
      student.student_name ||
      "طالب";

    select.appendChild(option);
  });
}

window.deleteStudent = async function(id) {

  if (!confirm("هل تريد حذف الطالب؟")) {
    return;
  }

  try {

    await api(`/api/students/${id}`, {
      method: "DELETE"
    });

    showToast(
      "تم حذف الطالب"
    );

    loadStudents();

  } catch (error) {

    showToast(
      error.message ||
      "تعذر حذف الطالب",
      false
    );
  }
};

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
            <input id="studentClass">
          </div>

          <div class="form-group">
            <label>هاتف ولي الأمر</label>
            <input id="parentPhone">
          </div>

          <div class="form-group">
            <label>الحالة</label>
            <select id="studentStatus">
              <option value="نشط">نشط</option>
              <option value="موقوف">موقوف</option>
            </select>
          </div>

          <button
            class="btn btn-primary"
            type="submit"
          >
            حفظ الطالب
          </button>

        </form>
      `
    );

    $("addStudentForm")?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        try {

          await api("/api/students", {
            method: "POST",
            body: JSON.stringify({

              name:
                $("studentName").value.trim(),

              class_name:
                $("studentClass").value.trim(),

              parent_phone:
                $("parentPhone").value.trim(),

              status:
                $("studentStatus").value

            })
          });

          closeModal();

          showToast(
            "تمت إضافة الطالب بنجاح"
          );

          loadStudents();

        } catch (error) {

          showToast(
            error.message ||
            "تعذر إضافة الطالب",
            false
          );
        }
      }
    );
  }
);

/* =====================================================
   EMPLOYEES
===================================================== */

async function loadEmployees() {

  const tbody =
    $("employeesTableBody");

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="9">
        جاري تحميل الموظفين...
      </td>
    </tr>
  `;

  try {

    const data =
      await api("/api/employees");

    const employees =
      Array.isArray(data)
        ? data
        : data.employees || [];

    if (!employees.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="9">
            لا يوجد موظفون
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      employees.map((employee, index) => `

        <tr>

          <td>${index + 1}</td>

          <td>
            ${escapeHTML(
              employee.employee_number ||
              employee.employee_id ||
              employee.id ||
              "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              employee.name ||
              "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              employee.job ||
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
            ${formatMoney(
              employee.salary
            )}
          </td>

          <td>
            ${escapeHTML(
              employee.status ||
              "نشط"
            )}
          </td>

          <td>

            <button
              class="btn btn-danger"
              onclick="deleteEmployee(${Number(employee.id)})"
            >
              حذف
            </button>

          </td>

        </tr>

      `).join("");

  } catch (error) {

    console.error(error);

    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          تعذر تحميل الموظفين
        </td>
      </tr>
    `;
  }
}

window.deleteEmployee = async function(id) {

  if (!confirm("هل تريد حذف الموظف؟")) {
    return;
  }

  try {

    await api(`/api/employees/${id}`, {
      method: "DELETE"
    });

    showToast(
      "تم حذف الموظف"
    );

    loadEmployees();

  } catch (error) {

    showToast(
      error.message ||
      "تعذر حذف الموظف",
      false
    );
  }
};

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
            <label>الاسم</label>
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
            <label>الراتب</label>
            <input id="employeeSalary" type="number">
          </div>

          <button
            class="btn btn-primary"
            type="submit"
          >
            حفظ الموظف
          </button>

        </form>
      `
    );

    $("addEmployeeForm")?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        try {

          await api("/api/employees", {
            method: "POST",
            body: JSON.stringify({

              employee_number:
                $("employeeNumber").value.trim(),

              name:
                $("employeeName").value.trim(),

              job:
                $("employeeJob").value.trim(),

              department:
                $("employeeDepartment").value.trim(),

              phone:
                $("employeePhone").value.trim(),

              salary:
                Number(
                  $("employeeSalary").value || 0
                )

            })
          });

          closeModal();

          showToast(
            "تمت إضافة الموظف بنجاح"
          );

          loadEmployees();

        } catch (error) {

          showToast(
            error.message ||
            "تعذر إضافة الموظف",
            false
          );
        }
      }
    );
  }
);

/* =====================================================
   ATTENDANCE
===================================================== */

async function loadAttendance() {

  await loadStudentAttendance();
  await loadEmployeeAttendance();

}

$("refreshStudentAttendance")?.addEventListener(
  "click",
  loadStudentAttendance
);

async function loadStudentAttendance() {

  const tbody =
    $("attendanceStudentsBody");

  if (!tbody) return;

  try {

    const data =
      await api("/api/attendance/students");

    const rows =
      Array.isArray(data)
        ? data
        : data.attendance || [];

    if (!rows.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="4">
            لا توجد بيانات حضور
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      rows.map(row => `

        <tr>

          <td>
            ${escapeHTML(
              row.student_name ||
              row.name ||
              "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              row.class_name ||
              "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              row.status ||
              "غير محدد"
            )}
          </td>

          <td>

            <button
              class="btn btn-primary"
              onclick="setAttendance(${Number(row.student_id || row.id)}, 'حاضر')"
            >
              حاضر
            </button>

            <button
              class="btn btn-danger"
              onclick="setAttendance(${Number(row.student_id || row.id)}, 'غائب')"
            >
              غائب
            </button>

          </td>

        </tr>

      `).join("");

  } catch (error) {

    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          تعذر تحميل الحضور
        </td>
      </tr>
    `;
  }
}

window.setAttendance = async function(
  studentId,
  status
) {

  try {

    await api("/api/attendance/students", {
      method: "POST",
      body: JSON.stringify({
        student_id: studentId,
        status
      })
    });

    showToast(
      `تم تسجيل الطالب: ${status}`
    );

    loadStudentAttendance();

  } catch (error) {

    showToast(
      error.message ||
      "تعذر تسجيل الحضور",
      false
    );
  }
};

async function loadEmployeeAttendance() {

  const tbody =
    $("attendanceEmployeesBody");

  if (!tbody) return;

  try {

    const data =
      await api("/api/attendance/employees");

    const rows =
      Array.isArray(data)
        ? data
        : data.attendance || [];

    if (!rows.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            لا توجد بيانات
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      rows.map(row => `

        <tr>

          <td>
            ${escapeHTML(
              row.employee_name ||
              row.name ||
              "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              row.date || "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              row.check_in || "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              row.check_out || "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              row.status || "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              row.delay || "0"
            )}
          </td>

        </tr>

      `).join("");

  } catch (error) {

    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          تعذر تحميل حضور الموظفين
        </td>
      </tr>
    `;
  }
}

/* =====================================================
   PAYROLL
===================================================== */

async function loadPayroll() {

  const tbody =
    $("payrollTableBody");

  if (!tbody) return;

  try {

    const data =
      await api("/api/payroll");

    const rows =
      Array.isArray(data)
        ? data
        : data.payroll || [];

    if (!rows.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            لا توجد بيانات رواتب
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      rows.map(row => {

        const basic =
          Number(row.basic || row.salary || 0);

        const allowances =
          Number(row.allowances || 0);

        const bonuses =
          Number(row.bonuses || 0);

        const deductions =
          Number(row.deductions || 0);

        const net =
          Number(
            row.net ||
            basic +
            allowances +
            bonuses -
            deductions
          );

        return `

          <tr>

            <td>
              ${escapeHTML(
                row.employee_name ||
                row.name ||
                "-"
              )}
            </td>

            <td>
              ${formatMoney(basic)}
            </td>

            <td>
              ${formatMoney(allowances)}
            </td>

            <td>
              ${formatMoney(bonuses)}
            </td>

            <td>
              ${formatMoney(deductions)}
            </td>

            <td>
              <strong>
                ${formatMoney(net)}
              </strong>
            </td>

            <td>

              <button
                class="btn btn-secondary"
                onclick="editPayroll(${Number(row.id)})"
              >
                تعديل
              </button>

            </td>

          </tr>

        `;
      }).join("");

  } catch (error) {

    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          تعذر تحميل الرواتب
        </td>
      </tr>
    `;
  }
}

window.editPayroll = function(id) {

  openModal(
    "تعديل الراتب",
    `
      <form id="payrollForm">

        <div class="form-group">
          <label>البدلات</label>
          <input id="payrollAllowances" type="number" value="0">
        </div>

        <div class="form-group">
          <label>المكافآت</label>
          <input id="payrollBonuses" type="number" value="0">
        </div>

        <div class="form-group">
          <label>الخصومات</label>
          <input id="payrollDeductions" type="number" value="0">
        </div>

        <button class="btn btn-primary">
          حفظ
        </button>

      </form>
    `
  );

  $("payrollForm")?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      try {

        await api(`/api/payroll/${id}`, {
          method: "PUT",
          body: JSON.stringify({

            allowances:
              Number(
                $("payrollAllowances").value || 0
              ),

            bonuses:
              Number(
                $("payrollBonuses").value || 0
              ),

            deductions:
              Number(
                $("payrollDeductions").value || 0
              )

          })
        });

        closeModal();

        showToast(
          "تم تحديث الراتب"
        );

        loadPayroll();

      } catch (error) {

        showToast(
          error.message ||
          "تعذر تحديث الراتب",
          false
        );
      }
    }
  );
};

$("payrollSettingsButton")?.addEventListener(
  "click",
  () => {

    openModal(
      "إعدادات الرواتب",
      `
        <p>
          يمكنك إدارة إعدادات الرواتب من خلال النظام.
        </p>
      `
    );

  }
);

/* =====================================================
   NOTES
===================================================== */

$("saveNoteButton")?.addEventListener(
  "click",
  saveNote
);

async function saveNote() {

  const studentId =
    $("noteStudent").value;

  const text =
    $("noteText").value.trim();

  if (!studentId) {

    showToast(
      "اختر الطالب أولاً",
      false
    );

    return;
  }

  if (!text) {

    showToast(
      "اكتب الملاحظة",
      false
    );

    return;
  }

  try {

    await api("/api/notes", {
      method: "POST",
      body: JSON.stringify({

        student_id:
          Number(studentId),

        note:
          text

      })
    });

    $("noteText").value = "";

    showToast(
      "تم حفظ الملاحظة"
    );

    loadNotes();

  } catch (error) {

    showToast(
      error.message ||
      "تعذر حفظ الملاحظة",
      false
    );
  }
}

async function loadNotes() {

  const tbody =
    $("notesTableBody");

  if (!tbody) return;

  try {

    const data =
      await api("/api/notes");

    const notes =
      Array.isArray(data)
        ? data
        : data.notes || [];

    if (!notes.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="4">
            لا توجد ملاحظات
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      notes.map(note => `

        <tr>

          <td>
            ${escapeHTML(
              note.student_name ||
              note.name ||
              "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              note.note ||
              note.text ||
              "-"
            )}
          </td>

          <td>
            ${formatDate(
              note.created_at ||
              note.date
            )}
          </td>

          <td>

            <button
              class="btn btn-danger"
              onclick="deleteNote(${Number(note.id)})"
            >
              حذف
            </button>

          </td>

        </tr>

      `).join("");

  } catch (error) {

    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          تعذر تحميل الملاحظات
        </td>
      </tr>
    `;
  }
}

window.deleteNote = async function(id) {

  if (!confirm("هل تريد حذف الملاحظة؟")) {
    return;
  }

  try {

    await api(`/api/notes/${id}`, {
      method: "DELETE"
    });

    showToast(
      "تم حذف الملاحظة"
    );

    loadNotes();

  } catch (error) {

    showToast(
      error.message ||
      "تعذر حذف الملاحظة",
      false
    );
  }
};

/* =====================================================
   VIDEOS
===================================================== */

async function loadVideos() {

  const container =
    $("videosGrid");

  if (!container) return;

  container.innerHTML =
    "جاري تحميل الحصص...";

  try {

    const data =
      await api("/api/videos");

    const videos =
      Array.isArray(data)
        ? data
        : data.videos || [];

    if (!videos.length) {

      container.innerHTML = `
        <div class="card">
          لا توجد حصص أو فيديوهات
        </div>
      `;

      return;
    }

    container.innerHTML =
      videos.map(video => `

        <div class="card">

          <h3>
            ${escapeHTML(
              video.title ||
              "حصة تعليمية"
            )}
          </h3>

          <p>
            ${escapeHTML(
              video.description ||
              ""
            )}
          </p>

          ${
            video.url
              ? `
                <a
                  href="${escapeHTML(video.url)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-primary"
                >
                  ▶️ مشاهدة
                </a>
              `
              : ""
          }

        </div>

      `).join("");

  } catch (error) {

    container.innerHTML = `
      <div class="card">
        تعذر تحميل الفيديوهات
      </div>
    `;
  }
}

$("addVideoButton")?.addEventListener(
  "click",
  () => {

    openModal(
      "إضافة حصة",
      `
        <form id="videoForm">

          <div class="form-group">
            <label>عنوان الحصة</label>
            <input id="videoTitle" required>
          </div>

          <div class="form-group">
            <label>الوصف</label>
            <textarea id="videoDescription"></textarea>
          </div>

          <div class="form-group">
            <label>رابط الفيديو</label>
            <input id="videoUrl" type="url" required>
          </div>

          <button
            class="btn btn-primary"
            type="submit"
          >
            حفظ الحصة
          </button>

        </form>
      `
    );

    $("videoForm")?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        try {

          await api("/api/videos", {
            method: "POST",
            body: JSON.stringify({

              title:
                $("videoTitle").value.trim(),

              description:
                $("videoDescription").value.trim(),

              url:
                $("videoUrl").value.trim()

            })
          });

          closeModal();

          showToast(
            "تمت إضافة الحصة"
          );

          loadVideos();

        } catch (error) {

          showToast(
            error.message ||
            "تعذر إضافة الحصة",
            false
          );
        }
      }
    );
  }
);

/* =====================================================
   LOGS
===================================================== */

async function loadLogs() {

  const tbody =
    $("logsTableBody");

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="5">
        جاري تحميل السجل...
      </td>
    </tr>
  `;

  try {

    const data =
      await api("/api/logs");

    const logs =
      Array.isArray(data)
        ? data
        : data.logs || [];

    if (!logs.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="5">
            لا توجد عمليات
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      logs.map((log, index) => `

        <tr>

          <td>
            ${index + 1}
          </td>

          <td>
            ${escapeHTML(
              log.username ||
              log.user_name ||
              log.user ||
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
            ${formatDate(
              log.created_at ||
              log.date
            )}
          </td>

        </tr>

      `).join("");

  } catch (error) {

    console.error(error);

    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          تعذر تحميل سجل العمليات
        </td>
      </tr>
    `;
  }
}

$("refreshLogs")?.addEventListener(
  "click",
  loadLogs
);

/* =====================================================
   MODAL
===================================================== */

function openModal(title, body) {

  const modal =
    $("modal");

  if (!modal) return;

  $("modalTitle").textContent =
    title;

  $("modalBody").innerHTML =
    body;

  modal.classList.remove("hidden");
}

function closeModal() {

  $("modal")?.classList.add(
    "hidden"
  );
}

$("modalClose")?.addEventListener(
  "click",
  closeModal
);

document
  .querySelector(".modal-overlay")
  ?.addEventListener(
    "click",
    closeModal
  );

/* =====================================================
   SESSION CHECK
===================================================== */

async function checkSession() {

  try {

    const data =
      await api("/api/me");

    currentUser =
      data.user ||
      data;

    if (currentUser) {
      showApp();
      return;
    }

  } catch (error) {
    console.log(
      "No active session"
    );
  }

  try {

    const saved =
      localStorage.getItem(
        "schoolUser"
      );

    if (saved) {

      currentUser =
        JSON.parse(saved);

      showApp();

      return;
    }

  } catch {
    localStorage.removeItem(
      "schoolUser"
    );
  }

  showLogin();
}

/* =====================================================
   START
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    checkSession();

  }
);
