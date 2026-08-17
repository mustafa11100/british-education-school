```javascript
const app = document.getElementById("app");

let me = null;
let currentSection = "dashboard";
let activityTimer = null;

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value) {
  return Number(value || 0).toLocaleString("ar-EG");
}

function roleName(role) {
  return {
    admin: "مدير",
    teacher: "مدرس",
    parent: "ولي أمر",
    student: "طالب"
  }[role] || role;
}

function statusBadge(status) {
  if (status === "حاضر") {
    return '<span class="badge success">🟢 حاضر</span>';
  }

  if (status === "غائب") {
    return '<span class="badge danger">🔴 غائب</span>';
  }

  if (status === "متأخر") {
    return '<span class="badge warning">🟠 متأخر</span>';
  }

  return `<span class="badge">${esc(status)}</span>`;
}

function dateText(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return esc(value);
  }

  return date.toLocaleString("ar-EG");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {})
    }
  });

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
      `خطأ في الخادم (${response.status})`
    );
  }

  return data;
}

/* =====================================================
   LOGIN
===================================================== */

function loginPage() {
  app.innerHTML = `
    <div class="login">
      <div class="card">

        <h1>🏫 مدرسة التعليم البريطاني</h1>

        <p>
          بوابة الإدارة والطلاب وأولياء الأمور
        </p>

        <input
          id="loginUsername"
          placeholder="اسم المستخدم"
          autocomplete="username"
        >

        <input
          id="loginPassword"
          type="password"
          placeholder="كلمة المرور"
          autocomplete="current-password"
        >

        <button onclick="login()">
          دخول
        </button>

        <div class="notice">
          <b>حسابات التجربة</b><br>
          الإدارة: admin / 1234<br>
          المدرس: teacher / 1234<br>
          ولي الأمر: parent / 1234<br>
          الطالب: student / 1234
        </div>

      </div>
    </div>
  `;
}

async function login() {
  try {
    const username =
      document
        .getElementById("loginUsername")
        .value
        .trim();

    const password =
      document
        .getElementById("loginPassword")
        .value;

    if (!username || !password) {
      alert(
        "أدخل اسم المستخدم وكلمة المرور"
      );
      return;
    }

    me = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    });

    localStorage.setItem(
      "me",
      JSON.stringify(me)
    );

    startActivity();

    await render();

  } catch (error) {
    alert(error.message);
  }
}

/* =====================================================
   LOGOUT
===================================================== */

function logout() {
  stopActivity();

  localStorage.removeItem("me");

  me = null;

  currentSection = "dashboard";

  loginPage();
}

/* =====================================================
   ACTIVITY
===================================================== */

function startActivity() {
  stopActivity();

  activityTimer = setInterval(
    async () => {

      if (!me || !me.id) {
        return;
      }

      try {

        const result =
          await api("/api/activity", {
            method: "POST",
            body: JSON.stringify({
              user_id: me.id
            })
          });

        me.last_seen =
          result.last_seen;

        localStorage.setItem(
          "me",
          JSON.stringify(me)
        );

      } catch (error) {

        if (
          error.message.includes("موقوف") ||
          error.message.includes("الحساب")
        ) {
          logout();
        }
      }

    },
    20000
  );
}

function stopActivity() {
  if (activityTimer) {
    clearInterval(activityTimer);
  }

  activityTimer = null;
}

/* =====================================================
   RENDER
===================================================== */

async function render() {

  if (!me) {
    loginPage();
    return;
  }

  try {

    if (me.role === "admin") {
      await renderAdmin();
      return;
    }

    if (me.role === "teacher") {
      await renderTeacher();
      return;
    }

    await renderFamily();

  } catch (error) {

    console.error(error);

    app.innerHTML = `
      <div class="wrap">

        <div class="notice">

          <h2>
            حدث خطأ في تحميل الصفحة
          </h2>

          <p>
            ${esc(error.message)}
          </p>

        </div>

        <button onclick="render()">
          إعادة المحاولة
        </button>

        <button onclick="logout()">
          خروج
        </button>

      </div>
    `;
  }
}

/* =====================================================
   LAYOUT
===================================================== */

function layout(content) {
  return `

    <header>

      <div>
        <b>
          🏫 مدرسة التعليم البريطاني
        </b>

        <small>
          ${esc(me?.name || "")}
        </small>
      </div>

      <div class="header-actions">

        <button onclick="showPasswordModal()">
          🔐 تغيير كلمة المرور
        </button>

        <button onclick="logout()">
          خروج
        </button>

      </div>

    </header>

    <main>

      <div class="wrap">

        ${content}

      </div>

    </main>
  `;
}

/* =====================================================
   NAVIGATION
===================================================== */

function nav(items) {
  return `

    <div class="nav-grid">

      ${items
        .map(
          item => `

            <button
              class="nav-btn ${
                currentSection === item.id
                  ? "active"
                  : ""
              }"
              onclick="go('${item.id}')"
            >
              ${item.icon}
              ${item.label}
            </button>

          `
        )
        .join("")}

    </div>
  `;
}

async function go(section) {

  currentSection = section;

  await render();
}

/* =====================================================
   ADMIN
===================================================== */

async function renderAdmin() {

  if (currentSection === "dashboard") {
    return adminDashboard();
  }

  if (currentSection === "users") {
    return adminUsers();
  }

  if (currentSection === "students") {
    return adminStudents();
  }

  if (currentSection === "employees") {
    return adminEmployees();
  }

  if (currentSection === "payroll") {
    return adminPayroll();
  }

  if (currentSection === "logs") {
    return adminLogs();
  }

  if (currentSection === "settings") {
    return adminSettings();
  }

  currentSection = "dashboard";

  return adminDashboard();
}

/* =====================================================
   ADMIN DASHBOARD
===================================================== */

async function adminDashboard() {

  const summary =
    await api("/api/admin/summary");

  const users =
    await api("/api/users");

  app.innerHTML =
    layout(`

      <h1>
        لوحة الإدارة
      </h1>

      ${adminNavOnly()}

      <div class="cards">

        <div class="card">
          الطلاب
          <div class="num">
            ${summary.students}
          </div>
        </div>

        <div class="card">
          الحاضرون
          <div class="num">
            ${summary.present}
          </div>
        </div>

        <div class="card">
          الغائبون
          <div class="num">
            ${summary.absent}
          </div>
        </div>

        <div class="card">
          الموظفون
          <div class="num">
            ${summary.employees}
          </div>
        </div>

        <div class="card">
          المستخدمون النشطون
          <div class="num">
            ${summary.users}
          </div>
        </div>

        <div class="card">
          المتصلون الآن
          <div class="num">
            ${summary.online}
          </div>
        </div>

      </div>

      <div class="card">

        <h2>
          حالة المستخدمين الآن
        </h2>

        <table class="table">

          <tr>
            <th>الاسم</th>
            <th>الصلاحية</th>
            <th>الحالة</th>
            <th>آخر نشاط</th>
          </tr>

          ${users
            .map(
              user => `

                <tr>

                  <td>
                    ${esc(user.name)}
                  </td>

                  <td>
                    ${roleName(user.role)}
                  </td>

                  <td>
                    ${
                      !user.active
                        ? "🔴 موقوف"
                        : user.online
                        ? "🟢 متصل الآن"
                        : "⚪ غير متصل"
                    }
                  </td>

                  <td>
                    ${
                      user.last_seen
                        ? dateText(
                            user.last_seen
                          )
                        : "لم يدخل بعد"
                    }
                  </td>

                </tr>

              `
            )
            .join("")}

        </table>

      </div>
    `);
}

/* =====================================================
   ADMIN NAV
===================================================== */

function adminNavOnly() {
  return nav([
    {
      id: "dashboard",
      icon: "📊",
      label: "الرئيسية"
    },
    {
      id: "users",
      icon: "👥",
      label: "المستخدمون"
    },
    {
      id: "students",
      icon: "👨‍🎓",
      label: "الطلاب"
    },
    {
      id: "employees",
      icon: "👨‍💼",
      label: "الموظفون"
    },
    {
      id: "payroll",
      icon: "💰",
      label: "الرواتب"
    },
    {
      id: "logs",
      icon: "📋",
      label: "السجل"
    },
    {
      id: "settings",
      icon: "⚙️",
      label: "الإعدادات"
    }
  ]);
}

/* =====================================================
   USERS
===================================================== */

async function adminUsers() {

  const users =
    await api("/api/users");

  app.innerHTML =
    layout(`

      <h1>
        👥 إدارة المستخدمين
      </h1>

      ${adminNavOnly()}

      <div class="form">

        <h2>
          إضافة مستخدم جديد
        </h2>

        <div class="row">

          <input
            id="newName"
            placeholder="الاسم الكامل"
          >

          <input
            id="newUsername"
            placeholder="اسم المستخدم"
          >

          <input
            id="newPassword"
            placeholder="كلمة المرور"
          >

          <select id="newRole">

            <option value="teacher">
              مدرس
            </option>

            <option value="parent">
              ولي أمر
            </option>

            <option value="student">
              طالب
            </option>

            <option value="admin">
              مدير
            </option>

          </select>

          <button onclick="addUser()">
            ➕ إضافة
          </button>

        </div>

      </div>

      <div class="card">

        <h2>
          المستخدمون
        </h2>

        <table class="table">

          <tr>
            <th>الاسم</th>
            <th>اسم المستخدم</th>
            <th>الصلاحية</th>
            <th>الحالة</th>
            <th>آخر نشاط</th>
            <th>إجراء</th>
          </tr>

          ${users
            .map(
              user => `

                <tr>

                  <td>
                    ${esc(user.name)}
                  </td>

                  <td>
                    ${esc(user.username)}
                  </td>

                  <td>
                    ${roleName(user.role)}
                  </td>

                  <td>
                    ${
                      !user.active
                        ? "🔴 موقوف"
                        : user.online
                        ? "🟢 متصل الآن"
                        : "⚪ غير متصل"
                    }
                  </td>

                  <td>
                    ${
                      user.last_seen
                        ? dateText(
                            user.last_seen
                          )
                        : "لم يدخل بعد"
                    }
                  </td>

                  <td>

                    ${
                      user.username === "admin"
                        ? "🔒 المدير الرئيسي"
                        : `
                          ${
                            user.active
                              ? `
                                <button
                                  onclick="disableUser(${user.id})"
                                >
                                  ⛔ إيقاف
                                </button>
                              `
                              : `
                                <button
                                  onclick="enableUser(${user.id})"
                                >
                                  ✅ تفعيل
                                </button>
                              `
                          }

                          <button
                            onclick="changeUserPassword(${user.id})"
                          >
                            🔐 باسورد
                          </button>

                          <button
                            onclick="deleteUser(${user.id})"
                          >
                            🗑️ حذف
                          </button>
                        `
                    }

                  </td>

                </tr>

              `
            )
            .join("")}

        </table>

      </div>
    `);
}

async function addUser() {
  try {

    const payload = {
      name:
        document
          .getElementById("newName")
          .value
          .trim(),

      username:
        document
          .getElementById("newUsername")
          .value
          .trim(),

      password:
        document
          .getElementById("newPassword")
          .value,

      role:
        document
          .getElementById("newRole")
          .value
    };

    if (
      !payload.name ||
      !payload.username ||
      !payload.password
    ) {
      alert("أكمل بيانات المستخدم");
      return;
    }

    await api("/api/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    alert("تم إضافة المستخدم");

    await adminUsers();

  } catch (error) {
    alert(error.message);
  }
}

async function disableUser(id) {

  if (
    !confirm(
      "هل تريد إيقاف هذا المستخدم؟"
    )
  ) {
    return;
  }

  try {

    await api(
      `/api/users/${id}/disable`,
      {
        method: "PATCH"
      }
    );

    await adminUsers();

  } catch (error) {
    alert(error.message);
  }
}

async function enableUser(id) {

  try {

    await api(
      `/api/users/${id}/enable`,
      {
        method: "PATCH"
      }
    );

    await adminUsers();

  } catch (error) {
    alert(error.message);
  }
}

async function deleteUser(id) {

  if (
    !confirm(
      "سيتم حذف المستخدم نهائيًا. متابعة؟"
    )
  ) {
    return;
  }

  try {

    await api(
      `/api/users/${id}`,
      {
        method: "DELETE"
      }
    );

    await adminUsers();

  } catch (error) {
    alert(error.message);
  }
}

async function changeUserPassword(id) {

  const newPassword =
    prompt(
      "اكتب كلمة المرور الجديدة:"
    );

  if (!newPassword) {
    return;
  }

  try {

    await api(
      `/api/users/${id}/password`,
      {
        method: "PATCH",
        body: JSON.stringify({
          new_password:
            newPassword
        })
      }
    );

    alert(
      "تم تغيير كلمة المرور"
    );

  } catch (error) {
    alert(error.message);
  }
}

/* =====================================================
   STUDENTS
===================================================== */

async function adminStudents() {

  const students =
    await api("/api/students");

  app.innerHTML =
    layout(`

      <h1>
        👨‍🎓 إدارة الطلاب
      </h1>

      ${adminNavOnly()}

      <div class="form">

        <h2>
          إضافة طالب
        </h2>

        <div class="row">

          <input
            id="studentName"
            placeholder="اسم الطالب"
          >

          <input
            id="studentClass"
            placeholder="الفصل"
          >

          <input
            id="studentPhone"
            placeholder="رقم ولي الأمر"
          >

          <button onclick="addStudent()">
            ➕ إضافة الطالب
          </button>

        </div>

      </div>

      <div class="card">

        <h2>
          الطلاب
        </h2>

        <table class="table">

          <tr>
            <th>الاسم</th>
            <th>الفصل</th>
            <th>الحالة</th>
            <th>ولي الأمر</th>
            <th>السجل</th>
            <th>إجراء</th>
          </tr>

          ${students
            .map(
              student => `

                <tr>

                  <td>
                    ${esc(student.name)}
                  </td>

                  <td>
                    ${esc(student.class_name)}
                  </td>

                  <td>
                    ${statusBadge(
                      student.status
                    )}
                  </td>

                  <td>
                    ${esc(
                      student.parent_phone
                    )}
                  </td>

                  <td>

                    <button
                      onclick="showStudentAttendance(${student.id})"
                    >
                      📅 عرض
                    </button>

                  </td>

                  <td>

                    <button
                      onclick="deleteStudent(${student.id})"
                    >
                      🗑️ حذف
                    </button>

                  </td>

                </tr>

              `
            )
            .join("")}

        </table>

      </div>

      <div id="studentDetails"></div>
    `);
}

async function addStudent() {

  try {

    const payload = {
      name:
        document
          .getElementById("studentName")
          .value
          .trim(),

      class_name:
        document
          .getElementById("studentClass")
          .value
          .trim(),

      parent_phone:
        document
          .getElementById("studentPhone")
          .value
          .trim()
    };

    if (
      !payload.name ||
      !payload.class_name
    ) {
      alert(
        "أدخل اسم الطالب والفصل"
      );
      return;
    }

    await api("/api/students", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    await adminStudents();

  } catch (error) {
    alert(error.message);
  }
}

async function deleteStudent(id) {

  if (
    !confirm(
      "حذف الطالب وسجل حضوره وملاحظاته؟"
    )
  ) {
    return;
  }

  try {

    await api(
      `/api/students/${id}`,
      {
        method: "DELETE"
      }
    );

    await adminStudents();

  } catch (error) {
    alert(error.message);
  }
}

async function showStudentAttendance(id) {

  try {

    const data =
      await api(
        `/api/students/${id}/attendance`
      );

    const box =
      document.getElementById(
        "studentDetails"
      );

    if (!box) {
      return;
    }

    box.innerHTML = `

      <div class="card">

        <h2>
          📅 سجل الحضور
        </h2>

        <p>
          الحاضر:
          <b>${data.present}</b>

          |

          الغائب:
          <b>${data.absent}</b>

          |

          نسبة الحضور:
          <b>${data.percentage}%</b>
        </p>

        <table class="table">

          <tr>
            <th>التاريخ</th>
            <th>الحالة</th>
          </tr>

          ${
            data.records
              .map(
                record => `

                  <tr>

                    <td>
                      ${esc(record.date)}
                    </td>

                    <td>
                      ${statusBadge(
                        record.status
                      )}
                    </td>

                  </tr>

                `
              )
              .join("") ||
            `
              <tr>
                <td colspan="2">
                  لا يوجد سجل بعد
                </td>
              </tr>
            `
          }

        </table>

      </div>
    `;

  } catch (error) {
    alert(error.message);
  }
}

/* =====================================================
   EMPLOYEES
===================================================== */

async function adminEmployees() {

  const employees =
    await api("/api/employees");

  const users =
    await api("/api/users");

  app.innerHTML =
    layout(`

      <h1>
        👨‍💼 إدارة الموظفين
      </h1>

      ${adminNavOnly()}

      <div class="form">

        <h2>
          إضافة موظف
        </h2>

        <div class="row">

          <input
            id="empNumber"
            placeholder="رقم الموظف"
          >

          <input
            id="empName"
            placeholder="اسم الموظف"
          >

          <input
            id="empJob"
            placeholder="المسمى الوظيفي"
          >

          <input
            id="empDept"
            placeholder="القسم"
          >

          <input
            id="empPhone"
            placeholder="الهاتف"
          >

          <input
            id="empHireDate"
            type="date"
          >

          <input
            id="empSalary"
            type="number"
            placeholder="الراتب الأساسي"
          >

          <input
            id="empAllowance"
            type="number"
            placeholder="البدلات"
          >

          <select id="empUser">

            <option value="">
              بدون حساب
            </option>

            ${users
              .filter(
                user =>
                  !employees.some(
                    emp =>
                      Number(
                        emp.user_id
                      ) ===
                      Number(user.id)
                  )
              )
              .map(
                user => `

                  <option
                    value="${user.id}"
                  >
                    ${esc(user.name)}
                    —
                    ${esc(user.username)}
                  </option>

                `
              )
              .join("")}

          </select>

          <button
            onclick="addEmployee()"
          >
            ➕ إضافة الموظف
          </button>

        </div>

      </div>

      <div class="card">

        <h2>
          الموظفون
        </h2>

        <table class="table">

          <tr>

            <th>
              الاسم
            </th>

            <th>
              الوظيفة
            </th>

            <th>
              القسم
            </th>

            <th>
              الراتب
            </th>

            <th>
              الحساب
            </th>

            <th>
              إجراء
            </th>

          </tr>

          ${
            employees
              .map(
                employee => `

                  <tr>

                    <td>
                      ${esc(
                        employee.name
                      )}
                    </td>

                    <td>
                      ${esc(
                        employee.job_title
                      )}
                    </td>

                    <td>
                      ${esc(
                        employee.department
                      )}
                    </td>

                    <td>
                      ${money(
                        Number(
                          employee.basic_salary
                        ) +
                        Number(
                          employee.allowance
                        )
                      )}
                    </td>

                    <td>
                      ${
                        employee.username
                          ? esc(
                              employee.username
                            )
                          : "بدون حساب"
                      }
                    </td>

                    <td>

                      <button
                        onclick="employeeDetails(${employee.id})"
                      >
                        📋 التفاصيل
                      </button>

                      <button
                        onclick="employeeAttendance(${employee.id})"
                      >
                        📅 الحضور
                      </button>

                      <button
                        onclick="employeeMoney(${employee.id})"
                      >
                        💰 المالي
                      </button>

                    </td>

                  </tr>

                `
              )
              .join("") ||
            `
              <tr>
                <td colspan="6">
                  لا يوجد موظفون
                </td>
              </tr>
            `
          }

        </table>

      </div>

      <div id="employeeDetails"></div>
    `);
}

async function addEmployee() {

  try {

    const payload = {
      employee_number:
        document
          .getElementById("empNumber")
          .value
          .trim(),

      name:
        document
          .getElementById("empName")
          .value
          .trim(),

      job_title:
        document
          .getElementById("empJob")
          .value
          .trim(),

      department:
        document
          .getElementById("empDept")
          .value
          .trim(),

      phone:
        document
          .getElementById("empPhone")
          .value
          .trim(),

      hire_date:
        document
          .getElementById("empHireDate")
          .value,

      basic_salary:
        Number(
          document
            .getElementById("empSalary")
            .value || 0
        ),

      allowance:
        Number(
          document
            .getElementById("empAllowance")
            .value || 0
        ),

      user_id:
        document
          .getElementById("empUser")
          .value || null
    };

    if (!payload.name) {
      alert(
        "أدخل اسم الموظف"
      );
      return;
    }

    await api("/api/employees", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    await adminEmployees();

  } catch (error) {
    alert(error.message);
  }
}

async function employeeDetails(id) {

  try {

    const employees =
      await api("/api/employees");

    const employee =
      employees.find(
        item =>
          Number(item.id) ===
          Number(id)
      );

    if (!employee) {
      return;
    }

    const target =
      document.getElementById(
        "employeeDetails"
      );

    if (!target) {
      return;
    }

    target.innerHTML = `

      <div class="card">

        <h2>
          📋 ${esc(employee.name)}
        </h2>

        <p>
          رقم الموظف:
          ${esc(
            employee.employee_number
          )}
        </p>

        <p>
          الوظيفة:
          ${esc(
            employee.job_title
          )}
        </p>

        <p>
          القسم:
          ${esc(
            employee.department
          )}
        </p>

        <p>
          الهاتف:
          ${esc(
            employee.phone
          )}
        </p>

        <p>
          تاريخ التعيين:
          ${esc(
            employee.hire_date
          )}
        </p>

        <p>
          الراتب الأساسي:
          <b>
            ${money(
              employee.basic_salary
            )}
          </b>
        </p>

        <p>
          البدلات:
          <b>
            ${money(
              employee.allowance
            )}
          </b>
        </p>

      </div>
    `;

  } catch (error) {
    alert(error.message);
  }
}

async function employeeAttendance(id) {

  try {

    const data =
      await api(
        `/api/employees/${id}/attendance`
      );

    const box =
      document.getElementById(
        "employeeDetails"
      );

    if (!box) {
      return;
    }

    box.innerHTML = `

      <div class="card">

        <h2>
          📅 حضور الموظف
        </h2>

        <p>
          الحضور:
          ${data.present}

          |

          الغياب:
          ${data.absent}

          |

          التأخير:
          ${data.late}
        </p>

        <table class="table">

          <tr>

            <th>
              التاريخ
            </th>

            <th>
              الدخول
            </th>

            <th>
              الخروج
            </th>

            <th>
              الحالة
            </th>

            <th>
              التأخير
            </th>

          </tr>

          ${
            data.records
              .map(
                record => `

                  <tr>

                    <td>
                      ${esc(
                        record.date
                      )}
                    </td>

                    <td>
                      ${esc(
                        record.checkIn ||
                        "-"
                      )}
                    </td>

                    <td>
                      ${esc(
                        record.checkOut ||
                        "-"
                      )}
                    </td>

                    <td>
                      ${statusBadge(
                        record.status
                      )}
                    </td>

                    <td>
                      ${
                        record.lateMinutes ||
                        0
                      }
                    </td>

                  </tr>

                `
              )
              .join("") ||
            `
              <tr>
                <td colspan="5">
                  لا يوجد سجل
                </td>
              </tr>
            `
          }

        </table>

      </div>
    `;

  } catch (error) {
    alert(error.message);
  }
}

/* =====================================================
   EMPLOYEE FINANCE
===================================================== */

function currentMonthValue() {

  const now =
    new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

async function employeeMoney(id) {

  try {

    const month =
      currentMonthValue();

    const payroll =
      await api(
        `/api/employees/${id}/payroll?month=${encodeURIComponent(
          month
        )}`
      );

    const deductions =
      await api(
        `/api/employees/${id}/deductions`
      );

    const bonuses =
      await api(
        `/api/employees/${id}/bonuses`
      );

    const box =
      document.getElementById(
        "employeeDetails"
      );

    if (!box) {
      return;
    }

    box.innerHTML = `

      <div class="card">

        <h2>
          💰 التفاصيل المالية
          —
          ${esc(
            payroll.employee.name
          )}
        </h2>

        <div class="cards">

          <div class="card">
            الأساسي
            <div class="num">
              ${money(
                payroll.basic_salary
              )}
            </div>
          </div>

          <div class="card">
            البدلات
            <div class="num">
              ${money(
                payroll.allowance
              )}
            </div>
          </div>

          <div class="card">
            المكافآت
            <div class="num">
              ${money(
                payroll.bonuses
              )}
            </div>
          </div>

          <div class="card">
            الخصومات
            <div class="num">
              ${money(
                payroll.deductions
              )}
            </div>
          </div>

          <div class="card">
            الصافي
            <div class="num">
              ${money(
                payroll.net
              )}
            </div>
          </div>

        </div>

        <div class="form">

          <h3>
            إضافة خصم
          </h3>

          <input
            id="dedAmount"
            type="number"
            placeholder="المبلغ"
          >

          <input
            id="dedReason"
            placeholder="سبب الخصم"
          >

          <button
            onclick="addDeduction(${id})"
          >
            إضافة الخصم
          </button>

        </div>

        <div class="form">

          <h3>
            إضافة مكافأة
          </h3>

          <input
            id="bonusAmount"
            type="number"
            placeholder="المبلغ"
          >

          <input
            id="bonusReason"
            placeholder="سبب المكافأة"
          >

          <button
            onclick="addBonus(${id})"
          >
            إضافة المكافأة
          </button>

        </div>

        <h3>
          الخصومات
        </h3>

        <table class="table">

          <tr>
            <th>التاريخ</th>
            <th>المبلغ</th>
            <th>السبب</th>
            <th>النوع</th>
            <th></th>
          </tr>

          ${
            deductions
              .map(
                item => `

                  <tr>

                    <td>
                      ${esc(
                        item.date
                      )}
                    </td>

                    <td>
                      ${money(
                        item.amount
                      )}
                    </td>

                    <td>
                      ${esc(
                        item.reason
                      )}
                    </td>

                    <td>
                      ${
                        item.automatic
                          ? "تلقائي"
                          : "يدوي"
                      }
                    </td>

                    <td>

                      <button
                        onclick="deleteDeduction(${item.id}, ${id})"
                      >
                        🗑️
                      </button>

                    </td>

                  </tr>

                `
              )
              .join("") ||
            `
              <tr>
                <td colspan="5">
                  لا توجد خصومات
                </td>
              </tr>
            `
          }

        </table>

        <h3>
          المكافآت
        </h3>

        <table class="table">

          <tr>
            <th>التاريخ</th>
            <th>المبلغ</th>
            <th>السبب</th>
            <th></th>
          </tr>

          ${
            bonuses
              .map(
                item => `

                  <tr>

                    <td>
                      ${esc(
                        item.date
                      )}
                    </td>

                    <td>
                      ${money(
                        item.amount
                      )}
                    </td>

                    <td>
                      ${esc(
                        item.reason
                      )}
                    </td>

                    <td>

                      <button
                        onclick="deleteBonus(${item.id}, ${id})"
                      >
                        🗑️
                      </button>

                    </td>

                  </tr>

                `
              )
              .join("") ||
            `
              <tr>
                <td colspan="4">
                  لا توجد مكافآت
                </td>
              </tr>
            `
          }

        </table>

      </div>
    `;

  } catch (error) {
    alert(error.message);
  }
}

async function addDeduction(id) {

  try {

    const amount =
      Number(
        document.getElementById(
          "dedAmount"
        ).value || 0
      );

    const reason =
      document
        .getElementById(
          "dedReason"
        )
        .value
        .trim();

    if (!amount || !reason) {
      alert(
        "أدخل مبلغ وسبب الخصم"
      );
      return;
    }

    await api(
      `/api/employees/${id}/deductions`,
      {
        method: "POST",
        body: JSON.stringify({
          amount,
          reason
        })
      }
    );

    await employeeMoney(id);

  } catch (error) {
    alert(error.message);
  }
}

async function deleteDeduction(
  deductionId,
  employeeId
) {

  if (
    !confirm(
      "حذف الخصم؟"
    )
  ) {
    return;
  }

  try {

    await api(
      `/api/deductions/${deductionId}`,
      {
        method: "DELETE"
      }
    );

    await employeeMoney(
      employeeId
    );

  } catch (error) {
    alert(error.message);
  }
}

async function addBonus(id) {

  try {

    const amount =
      Number(
        document.getElementById(
          "bonusAmount"
        ).value || 0
      );

    const reason =
      document
        .getElementById(
          "bonusReason"
        )
        .value
        .trim();

    if (!amount || !reason) {
      alert(
        "أدخل مبلغ وسبب المكافأة"
      );
      return;
    }

    await api(
      `/api/employees/${id}/bonuses`,
      {
        method: "POST",
        body: JSON.stringify({
          amount,
          reason
        })
      }
    );

    await employeeMoney(id);

  } catch (error) {
    alert(error.message);
  }
}

async function deleteBonus(
  bonusId,
  employeeId
) {

  if (
    !confirm(
      "حذف المكافأة؟"
    )
  ) {
    return;
  }

  try {

    await api(
      `/api/bonuses/${bonusId}`,
      {
        method: "DELETE"
      }
    );

    await employeeMoney(
      employeeId
    );

  } catch (error) {
    alert(error.message);
  }
}

/* =====================================================
   PAYROLL
===================================================== */

async function adminPayroll() {

  const month =
    currentMonthValue();

  const data =
    await api(
      `/api/payroll?month=${encodeURIComponent(
        month
      )}`
    );

  app.innerHTML =
    layout(`

      <h1>
        💰 الرواتب
      </h1>

      ${adminNavOnly()}

      <div class="card">

        <h2>
          كشف شهر ${esc(month)}
        </h2>

        <table class="table">

          <tr>

            <th>الموظف</th>
            <th>الأساسي</th>
            <th>البدلات</th>
            <th>المكافآت</th>
            <th>الخصومات</th>
            <th>الإجمالي</th>
            <th>الصافي</th>

          </tr>

          ${
            data.employees
              .map(
                employee => `

                  <tr>

                    <td>
                      ${esc(
                        employee.name
                      )}
                    </td>

                    <td>
                      ${money(
                        employee.basic_salary
                      )}
                    </td>

                    <td>
                      ${money(
                        employee.allowance
                      )}
                    </td>

                    <td>
                      ${money(
                        employee.bonuses
                      )}
                    </td>

                    <td>
                      ${money(
                        employee.deductions
                      )}
                    </td>

                    <td>
                      ${money(
                        employee.gross
                      )}
                    </td>

                    <td>
                      <b>
                        ${money(
                          employee.net
                        )}
                      </b>
                    </td>

                  </tr>

                `
              )
              .join("") ||
            `
              <tr>
                <td colspan="7">
                  لا يوجد موظفون
                </td>
              </tr>
            `
          }

        </table>

      </div>
    `);
}

/* =====================================================
   LOGS
===================================================== */

async function adminLogs() {

  const logs =
    await api(
      "/api/audit-logs"
    );

  app.innerHTML =
    layout(`

      <h1>
        📋 سجل العمليات
      </h1>

      ${adminNavOnly()}

      <div class="card">

        <table class="table">

          <tr>
            <th>التاريخ</th>
            <th>المستخدم</th>
            <th>العملية</th>
            <th>التفاصيل</th>
          </tr>

          ${
            logs
              .map(
                log => `

                  <tr>

                    <td>
                      ${dateText(
                        log.createdAt ||
                        log.created_at
                      )}
                    </td>

                    <td>
                      ${esc(
                        log.user_name ||
                        log.userName ||
                        "النظام"
                      )}
                    </td>

                    <td>
                      ${esc(
                        log.action
                      )}
                    </td>

                    <td>
                      ${esc(
                        log.details
                      )}
                    </td>

                  </tr>

                `
              )
              .join("") ||
            `
              <tr>
                <td colspan="4">
                  لا يوجد سجل
                </td>
              </tr>
            `
          }

        </table>

      </div>
    `);
}

/* =====================================================
   SETTINGS
===================================================== */

async function adminSettings() {

  const settings =
    await api(
      "/api/payroll-settings"
    );

  app.innerHTML =
    layout(`

      <h1>
        ⚙️ إعدادات الرواتب
      </h1>

      ${adminNavOnly()}

      <div class="form">

        <label>
          خصم الغياب
        </label>

        <input
          id="absenceDeduction"
          type="number"
          value="${
            Number(
              settings.absence_deduction ||
              0
            )
          }"
        >

        <label>
          خصم التأخير
        </label>

        <input
          id="lateDeduction"
          type="number"
          value="${
            Number(
              settings.late_deduction ||
              0
            )
          }"
        >

        <label>
          الدقائق المسموحة
        </label>

        <input
          id="allowedLate"
          type="number"
          value="${
            Number(
              settings.allowed_late_minutes ||
              0
            )
          }"
        >

        <label>
          بداية الدوام
        </label>

        <input
          id="workStart"
          type="time"
          value="${
            esc(
              settings.work_start ||
              "08:00"
            )
          }"
        >

        <button onclick="saveSettings()">
          💾 حفظ الإعدادات
        </button>

      </div>
    `);
}

async function saveSettings() {

  try {

    await api(
      "/api/payroll-settings",
      {
        method: "PATCH",
        body: JSON.stringify({
          absence_deduction:
            Number(
              document
                .getElementById(
                  "absenceDeduction"
                )
                .value || 0
            ),

          late_deduction:
            Number(
              document
                .getElementById(
                  "lateDeduction"
                )
                .value || 0
            ),

          allowed_late_minutes:
            Number(
              document
                .getElementById(
                  "allowedLate"
                )
                .value || 0
            ),

          work_start:
            document
              .getElementById(
                "workStart"
              )
              .value ||
            "08:00"
        })
      }
    );

    alert(
      "تم حفظ الإعدادات"
    );

  } catch (error) {
    alert(error.message);
  }
}

/* =====================================================
   TEACHER
===================================================== */

async function renderTeacher() {

  if (
    currentSection !==
      "dashboard" &&
    currentSection !==
      "attendance" &&
    currentSection !==
      "notes" &&
    currentSection !==
      "videos"
  ) {
    currentSection =
      "dashboard";
  }

  if (
    currentSection ===
    "attendance"
  ) {
    return teacherAttendance();
  }

  if (
    currentSection ===
    "notes"
  ) {
    return teacherNotes();
  }

  if (
    currentSection ===
    "videos"
  ) {
    return teacherVideos();
  }

  return teacherDashboard();
}

function teacherNav() {
  return nav([
    {
      id: "dashboard",
      icon: "🏠",
      label: "الرئيسية"
    },
    {
      id: "attendance",
      icon: "📅",
      label: "الحضور"
    },
    {
      id: "notes",
      icon: "📝",
      label: "الملاحظات"
    },
    {
      id: "videos",
      icon: "🎥",
      label: "الحصص"
    }
  ]);
}

async function teacherDashboard() {

  const students =
    await api(
      "/api/students"
    );

  app.innerHTML =
    layout(`

      <h1>
        👨‍🏫 بوابة المدرس
      </h1>

      ${teacherNav()}

      <div class="cards">

        <div class="card">
          الطلاب
          <div class="num">
            ${students.length}
          </div>
        </div>

        <div class="card">
          الحاضرون
          <div class="num">
            ${
              students.filter(
                student =>
                  student.status ===
                  "حاضر"
              ).length
            }
          </div>
        </div>

        <div class="card">
          الغائبون
          <div class="num">
            ${
              students.filter(
                student =>
                  student.status ===
                  "غائب"
              ).length
            }
          </div>
        </div>

      </div>
    `);
}

async function teacherAttendance() {

  const students =
    await api(
      "/api/students"
    );

  app.innerHTML =
    layout(`

      <h1>
        📅 الحضور والغياب
      </h1>

      ${teacherNav()}

      <div class="card">

        <table class="table">

          <tr>

            <th>
              الطالب
            </th>

            <th>
              الفصل
            </th>

            <th>
              الحالة
            </th>

            <th>
              إجراء
            </th>

          </tr>

          ${
            students
              .map(
                student => `

                  <tr>

                    <td>
                      ${esc(
                        student.name
                      )}
                    </td>

                    <td>
                      ${esc(
                        student.class_name
                      )}
                    </td>

                    <td>
                      ${statusBadge(
                        student.status
                      )}
                    </td>

                    <td>

                      <button
                        onclick="toggleStudent(${student.id})"
                      >
                        تغيير
                      </button>

                    </td>

                  </tr>

                `
              )
              .join("")
          }

        </table>

      </div>
    `);
}

async function toggleStudent(id) {

  try {

    await api(
      `/api/students/${id}/status`,
      {
        method: "PATCH"
      }
    );

    await teacherAttendance();

  } catch (error) {
    alert(error.message);
  }
}

/* =====================================================
   NOTES
===================================================== */

async function teacherNotes() {

  const students =
    await api(
      "/api/students"
    );

  app.innerHTML =
    layout(`

      <h1>
        📝 ملاحظات الطلاب
      </h1>

      ${teacherNav()}

      <div class="form">

        <select id="noteStudent">

          ${
            students
              .map(
                student => `

                  <option
                    value="${student.id}"
                  >
                    ${esc(
                      student.name
                    )}
                  </option>

                `
              )
              .join("")
          }

        </select>

        <textarea
          id="noteText"
          placeholder="اكتب الملاحظة"
        ></textarea>

        <button
          onclick="saveNote()"
        >
          💾 حفظ الملاحظة
        </button>

      </div>

      <div class="card">

        <p>
          الملاحظة تُحفظ في النظام حاليًا.
          ربط WhatsApp الفعلي يحتاج
          WhatsApp Business API.
        </p>

      </div>
    `);
}

async function saveNote() {

  try {

    const studentId =
      Number(
        document
          .getElementById(
            "noteStudent"
          )
          .value
      );

    const text =
      document
        .getElementById(
          "noteText"
        )
        .value
        .trim();

    if (!text) {
      alert(
        "اكتب الملاحظة"
      );
      return;
    }

    await api(
      "/api/notes",
      {
        method: "POST",
        body: JSON.stringify({
          student_id:
            studentId,
          text
        })
      }
    );

    alert(
      "تم حفظ الملاحظة"
    );

    await teacherNotes();

  } catch (error) {
    alert(error.message);
  }
}

/* =====================================================
   VIDEOS
===================================================== */

async function teacherVideos() {

  const videos =
    await api(
      "/api/videos"
    );

  app.innerHTML =
    layout(`

      <h1>
        🎥 الحصص
      </h1>

      ${teacherNav()}

      <div class="form">

        <input
          id="videoTitle"
          placeholder="اسم الحصة أو المادة"
        >

        <input
          id="videoFile"
          type="file"
          accept="video/*"
        >

        <button
          onclick="saveVideo()"
        >
          💾 حفظ الحصة
        </button>

        <p>
          حفظ اسم الملف فقط في هذه المرحلة.
        </p>

      </div>

      <div class="card">

        <table class="table">

          <tr>
            <th>الحصة</th>
            <th>الملف</th>
            <th>التاريخ</th>
          </tr>

          ${
            videos
              .map(
                video => `

                  <tr>

                    <td>
                      ${esc(
                        video.title
                      )}
                    </td>

                    <td>
                      ${esc(
                        video.fileName ||
                        video.file_name ||
                        "-"
                      )}
                    </td>

                    <td>
                      ${dateText(
                        video.createdAt ||
                        video.created_at
                      )}
                    </td>

                  </tr>

                `
              )
              .join("") ||
            `
              <tr>
                <td colspan="3">
                  لا توجد حصص
                </td>
              </tr>
            `
          }

        </table>

      </div>
    `);
}

async function saveVideo() {

  try {

    const title =
      document
        .getElementById(
          "videoTitle"
        )
        .value
        .trim();

    const file =
      document
        .getElementById(
          "videoFile"
        )
        .files[0];

    if (!title) {
      alert(
        "اكتب اسم الحصة"
      );
      return;
    }

    await api(
      "/api/videos",
      {
        method: "POST",
        body: JSON.stringify({
          title,
          file_name:
            file
              ? file.name
              : ""
        })
      }
    );

    alert(
      "تم حفظ بيانات الحصة"
    );

    await teacherVideos();

  } catch (error) {
    alert(error.message);
  }
}

/* =====================================================
   FAMILY
===================================================== */

async function renderFamily() {

  const students =
    await api(
      "/api/students"
    );

  const student =
    students[0];

  if (!student) {

    app.innerHTML =
      layout(`

        <h1>
          👨‍👩‍👦 بوابة الطالب / ولي الأمر
        </h1>

        <div class="notice">
          لا يوجد طالب مرتبط بهذا الحساب حاليًا.
        </div>

      `);

    return;
  }

  const notes =
    await api(
      `/api/notes/${student.id}`
    );

  const videos =
    await api(
      "/api/videos"
    );

  const attendance =
    await api(
      `/api/students/${student.id}/attendance`
    );

  app.innerHTML =
    layout(`

      <h1>
        👨‍👩‍👦 بوابة الأسرة
      </h1>

      <div class="cards">

        <div class="card">
          الطالب

          <div class="num">
            ${esc(
              student.name
            )}
          </div>

          <p>
            ${esc(
              student.class_name
            )}
          </p>

        </div>

        <div class="card">
          حالة اليوم

          <div class="num">
            ${esc(
              student.status
            )}
          </div>
        </div>

        <div class="card">
          نسبة الحضور

          <div class="num">
            ${attendance.percentage}%
          </div>
        </div>

      </div>

      <h2>
        📝 الملاحظات
      </h2>

      ${
        notes
          .map(
            note => `

              <div class="notice">

                <b>
                  ${dateText(
                    note.createdAt ||
                    note.created_at
                  )}
                </b>

                <br>

                ${esc(
                  note.text
                )}

              </div>

            `
          )
          .join("") ||
        `
          <div class="card">
            لا توجد ملاحظات.
          </div>
        `
      }

      <h2>
        📅 سجل الحضور
      </h2>

      <div class="card">

        <table class="table">

          <tr>
            <th>التاريخ</th>
            <th>الحالة</th>
          </tr>

          ${
            attendance.records
              .map(
                record => `

                  <tr>

                    <td>
                      ${esc(
                        record.date
                      )}
                    </td>

                    <td>
                      ${statusBadge(
                        record.status
                      )}
                    </td>

                  </tr>

                `
              )
              .join("") ||
            `
              <tr>
                <td colspan="2">
                  لا يوجد سجل بعد
                </td>
              </tr>
            `
          }

        </table>

      </div>

      <h2>
        🎥 الحصص
      </h2>

      ${
        videos
          .map(
            video => `

              <div class="card">

                🎥
                ${esc(
                  video.title
                )}

                <br>

                <small>
                  ${dateText(
                    video.createdAt ||
                    video.created_at
                  )}
                </small>

              </div>

            `
          )
          .join("") ||
        `
          <div class="card">
            لا توجد حصص.
          </div>
        `
      }

    `);
}

/* =====================================================
   CHANGE PASSWORD
===================================================== */

function showPasswordModal() {

  const existing =
    document.getElementById(
      "passwordModal"
    );

  if (existing) {
    existing.remove();
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    `

      <div
        id="passwordModal"
        class="modal-overlay"
      >

        <div class="modal-card">

          <h2>
            🔐 تغيير كلمة المرور
          </h2>

          <input
            id="currentPassword"
            type="password"
            placeholder="كلمة المرور الحالية"
          >

          <input
            id="newPassword"
            type="password"
            placeholder="كلمة المرور الجديدة"
          >

          <div class="row">

            <button
              onclick="changeMyPassword()"
            >
              حفظ
            </button>

            <button
              onclick="document.getElementById('passwordModal').remove()"
            >
              إلغاء
            </button>

          </div>

        </div>

      </div>

    `
  );
}

async function changeMyPassword() {

  try {

    const currentPassword =
      document
        .getElementById(
          "currentPassword"
        )
        .value;

    const newPassword =
      document
        .getElementById(
          "newPassword"
        )
        .value;

    if (
      !currentPassword ||
      !newPassword
    ) {
      alert(
        "أدخل كلمات المرور"
      );
      return;
    }

    await api(
      `/api/users/${me.id}/password`,
      {
        method: "PATCH",
        body: JSON.stringify({
          current_password:
            currentPassword,

          new_password:
            newPassword
        })
      }
    );

    alert(
      "تم تغيير كلمة المرور"
    );

    const modal =
      document.getElementById(
        "passwordModal"
      );

    if (modal) {
      modal.remove();
    }

  } catch (error) {
    alert(error.message);
  }
}

/* =====================================================
   START
===================================================== */

try {

  me = JSON.parse(
    localStorage.getItem(
      "me"
    ) || "null"
  );

} catch {

  me = null;

  localStorage.removeItem(
    "me"
  );
}

if (me) {
  startActivity();
}

render();
```
