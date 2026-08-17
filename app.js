"use strict";

/* =====================================================
   ELEMENTS
===================================================== */

const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

const logoutButton = document.getElementById("logoutButton");

const currentUserName =
  document.getElementById("currentUserName");

const navItems =
  document.querySelectorAll(".nav-item");

const pageSections =
  document.querySelectorAll(".page-section");

const toast =
  document.getElementById("toast");


/* =====================================================
   CURRENT USER
===================================================== */

let currentUser =
  JSON.parse(
    localStorage.getItem("schoolCurrentUser") || "null"
  );


/* =====================================================
   API HELPER
===================================================== */

async function api(url, options = {}) {

  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  };

  const response =
    await fetch(url, config);

  let data = {};

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {

    throw new Error(
      data.error ||
      `خطأ HTTP ${response.status}`
    );
  }

  return data;
}


/* =====================================================
   TOAST
===================================================== */

function showToast(message) {

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
  toast.style.background = "#173b70";
  toast.style.color = "#fff";
  toast.style.borderRadius = "10px";
  toast.style.boxShadow =
    "0 10px 30px rgba(0,0,0,.2)";

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}


/* =====================================================
   LOGIN
===================================================== */

loginForm.addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();

    const username =
      usernameInput.value.trim();

    const password =
      passwordInput.value;

    if (!username || !password) {

      loginMessage.textContent =
        "أدخل اسم المستخدم وكلمة المرور";

      return;
    }

    loginMessage.textContent =
      "جاري تسجيل الدخول...";

    try {

      const data =
        await api("/api/login", {

          method: "POST",

          body: JSON.stringify({
            username,
            password
          })

        });

      currentUser = data.user;

      localStorage.setItem(
        "schoolCurrentUser",
        JSON.stringify(currentUser)
      );

      loginMessage.textContent = "";

      enterApplication();

    } catch (error) {

      console.error(error);

      loginMessage.textContent =
        error.message ||
        "تعذر تسجيل الدخول";

    }

  }
);


/* =====================================================
   ENTER APPLICATION
===================================================== */

function enterApplication() {

  loginPage.classList.add("hidden");

  appPage.classList.remove("hidden");

  if (currentUser) {

    currentUserName.textContent =
      currentUser.name ||
      currentUser.username;

  }

  showPage("dashboard");

  loadDashboard();

}


/* =====================================================
   LOGOUT
===================================================== */

logoutButton.addEventListener(
  "click",
  async function () {

    try {

      if (currentUser) {

        await api("/api/logout", {

          method: "POST",

          body: JSON.stringify({
            userId: currentUser.id
          })

        });

      }

    } catch (error) {

      console.error(error);

    }

    localStorage.removeItem(
      "schoolCurrentUser"
    );

    currentUser = null;

    appPage.classList.add("hidden");

    loginPage.classList.remove("hidden");

    loginForm.reset();

    loginMessage.textContent = "";

  }
);


/* =====================================================
   NAVIGATION
===================================================== */

navItems.forEach(item => {

  item.addEventListener(
    "click",
    function () {

      const page =
        item.dataset.page;

      showPage(page);

    }
  );

});


function showPage(page) {

  pageSections.forEach(section => {

    section.classList.add("hidden");

  });

  navItems.forEach(item => {

    item.classList.remove("active");

  });

  const target =
    document.getElementById(
      `page-${page}`
    );

  if (target) {
    target.classList.remove("hidden");
  }

  const activeItem =
    document.querySelector(
      `.nav-item[data-page="${page}"]`
    );

  if (activeItem) {
    activeItem.classList.add("active");
  }


  /* تحميل بيانات الصفحة */

  if (page === "dashboard") {
    loadDashboard();
  }

  if (page === "users") {
    loadUsers();
  }

  if (page === "students") {
    loadStudents();
  }

  if (page === "employees") {
    loadEmployees();
  }

  if (page === "attendance") {
    loadAttendance();
  }

  if (page === "payroll") {
    loadPayroll();
  }

  if (page === "notes") {
    loadNotes();
    loadStudentsForNotes();
  }

  if (page === "videos") {
    loadVideos();
  }

  if (page === "logs") {
    loadLogs();
  }

}


/* =====================================================
   DASHBOARD
===================================================== */

async function loadDashboard() {

  try {

    const data =
      await api("/api/dashboard");

    const stats =
      data.stats || {};

    document.getElementById(
      "statUsers"
    ).textContent =
      stats.users || 0;

    document.getElementById(
      "statOnline"
    ).textContent =
      stats.online || 0;

    document.getElementById(
      "statStudents"
    ).textContent =
      stats.students || 0;

    document.getElementById(
      "statEmployees"
    ).textContent =
      stats.employees || 0;


    const health =
      document.getElementById(
        "healthStatus"
      );

    health.innerHTML =
      `<span style="color:#198754;font-weight:bold">
        🟢 النظام يعمل بشكل طبيعي
      </span>`;


    const list =
      document.getElementById(
        "onlineUsersList"
      );

    const users =
      data.onlineUsers || [];

    if (!users.length) {

      list.textContent =
        "لا يوجد مستخدمون متصلون الآن";

      return;
    }

    list.innerHTML =
      users.map(user => {

        return `
          <div style="
            padding:10px 0;
            border-bottom:1px solid #eee;
          ">
            🟢
            <strong>
              ${escapeHtml(user.name)}
            </strong>
            <small>
              (${escapeHtml(user.username)})
            </small>
          </div>
        `;

      }).join("");


  } catch (error) {

    console.error(error);

    document.getElementById(
      "healthStatus"
    ).textContent =
      "تعذر تحميل بيانات النظام";

  }

}


/* =====================================================
   USERS
===================================================== */

async function loadUsers() {

  try {

    const data =
      await api("/api/users");

    const users =
      data.users || [];

    const body =
      document.getElementById(
        "usersTableBody"
      );

    document.getElementById(
      "usersTotal"
    ).textContent =
      users.length;

    document.getElementById(
      "usersActive"
    ).textContent =
      users.filter(
        user => Number(user.active) === 1
      ).length;

    document.getElementById(
      "usersOnline"
    ).textContent =
      users.filter(
        user =>
          Number(user.online) === 1 &&
          Number(user.active) === 1
      ).length;


    if (!users.length) {

      body.innerHTML =
        `<tr>
          <td colspan="7">
            لا توجد مستخدمين
          </td>
        </tr>`;

      return;
    }


    body.innerHTML =
      users.map((user, index) => {

        const active =
          Number(user.active) === 1;

        const online =
          Number(user.online) === 1;

        return `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              ${escapeHtml(user.username)}
            </td>

            <td>
              ${escapeHtml(user.name)}
            </td>

            <td>
              ${user.role === "admin"
                ? "مدير"
                : "مستخدم"}
            </td>

            <td>
              ${
                active
                  ? "🟢 نشط"
                  : "🔴 موقوف"
              }
            </td>

            <td>
              ${
                online
                  ? "متصل الآن"
                  : formatDate(user.last_seen)
              }
            </td>

            <td>

              ${
                user.username !== "admin"
                  ? `
                    <button
                      class="btn btn-secondary"
                      onclick="toggleUser(${user.id}, ${active})"
                    >
                      ${active ? "إيقاف" : "تفعيل"}
                    </button>

                    <button
                      class="btn btn-danger"
                      onclick="deleteUser(${user.id})"
                    >
                      حذف
                    </button>
                  `
                  : `
                    <strong>
                      المدير الرئيسي
                    </strong>
                  `
              }

            </td>

          </tr>
        `;

      }).join("");

  } catch (error) {

    console.error(error);

    showToast(
      error.message
    );

  }

}


/* =====================================================
   TOGGLE USER
===================================================== */

window.toggleUser =
async function(id, active) {

  try {

    await api(
      `/api/users/${id}/status`,
      {
        method: "PATCH",

        body: JSON.stringify({
          active: !active
        })
      }
    );

    showToast(
      !active
        ? "تم تفعيل المستخدم"
        : "تم إيقاف المستخدم"
    );

    loadUsers();

  } catch (error) {

    showToast(
      error.message
    );

  }

};


/* =====================================================
   DELETE USER
===================================================== */

window.deleteUser =
async function(id) {

  if (!confirm(
    "هل أنت متأكد من حذف المستخدم؟"
  )) {
    return;
  }

  try {

    await api(
      `/api/users/${id}`,
      {
        method: "DELETE"
      }
    );

    showToast(
      "تم حذف المستخدم"
    );

    loadUsers();

  } catch (error) {

    showToast(
      error.message
    );

  }

};


/* =====================================================
   ADD USER
===================================================== */

document
  .getElementById("addUserButton")
  .addEventListener(
    "click",
    function () {

      openModal(
        "إضافة مستخدم",
        `
          <form id="addUserForm">

            <div class="form-group">
              <label>الاسم</label>
              <input
                id="newUserName"
                required
              >
            </div>

            <div class="form-group">
              <label>اسم المستخدم</label>
              <input
                id="newUsername"
                required
              >
            </div>

            <div class="form-group">
              <label>كلمة المرور</label>
              <input
                id="newUserPassword"
                type="password"
                required
              >
            </div>

            <button
              class="btn btn-primary"
              type="submit"
            >
              إنشاء المستخدم
            </button>

          </form>
        `
      );


      document
        .getElementById("addUserForm")
        .addEventListener(
          "submit",
          async function(event) {

            event.preventDefault();

            try {

              await api(
                "/api/users",
                {
                  method: "POST",

                  body: JSON.stringify({

                    name:
                      document
                        .getElementById(
                          "newUserName"
                        )
                        .value.trim(),

                    username:
                      document
                        .getElementById(
                          "newUsername"
                        )
                        .value.trim(),

                    password:
                      document
                        .getElementById(
                          "newUserPassword"
                        )
                        .value,

                    role: "user"

                  })

                }
              );

              closeModal();

              showToast(
                "تم إنشاء المستخدم"
              );

              loadUsers();

            } catch (error) {

              showToast(
                error.message
              );

            }

          }
        );

    }
  );


/* =====================================================
   STUDENTS
===================================================== */

async function loadStudents() {

  try {

    const data =
      await api("/api/students");

    const students =
      data.students || [];

    const body =
      document.getElementById(
        "studentsTableBody"
      );

    if (!students.length) {

      body.innerHTML =
        `<tr>
          <td colspan="6">
            لا توجد بيانات طلاب
          </td>
        </tr>`;

      return;
    }

    body.innerHTML =
      students.map((student, index) => {

        return `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              ${escapeHtml(student.name)}
            </td>

            <td>
              ${escapeHtml(student.class_name)}
            </td>

            <td>
              ${escapeHtml(student.parent_phone)}
            </td>

            <td>
              ${escapeHtml(student.status)}
            </td>

            <td>

              <button
                class="btn btn-danger"
                onclick="deleteStudent(${student.id})"
              >
                حذف
              </button>

            </td>

          </tr>
        `;

      }).join("");

  } catch (error) {

    showToast(
      error.message
    );

  }

}


/* =====================================================
   ADD STUDENT
===================================================== */

document
  .getElementById("addStudentButton")
  .addEventListener(
    "click",
    function() {

      openModal(
        "إضافة طالب",
        `
          <form id="addStudentForm">

            <div class="form-group">
              <label>اسم الطالب</label>
              <input
                id="studentName"
                required
              >
            </div>

            <div class="form-group">
              <label>الفصل</label>
              <input
                id="studentClass"
              >
            </div>

            <div class="form-group">
              <label>هاتف ولي الأمر</label>
              <input
                id="parentPhone"
              >
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


      document
        .getElementById(
          "addStudentForm"
        )
        .addEventListener(
          "submit",
          async function(event) {

            event.preventDefault();

            try {

              await api(
                "/api/students",
                {
                  method: "POST",

                  body: JSON.stringify({

                    name:
                      document
                        .getElementById(
                          "studentName"
                        )
                        .value.trim(),

                    class_name:
                      document
                        .getElementById(
                          "studentClass"
                        )
                        .value.trim(),

                    parent_phone:
                      document
                        .getElementById(
                          "parentPhone"
                        )
                        .value.trim()

                  })

                }
              );

              closeModal();

              showToast(
                "تمت إضافة الطالب"
              );

              loadStudents();

            } catch (error) {

              showToast(
                error.message
              );

            }

          }
        );

    }
  );


window.deleteStudent =
async function(id) {

  if (!confirm(
    "هل تريد حذف الطالب؟"
  )) {
    return;
  }

  try {

    await api(
      `/api/students/${id}`,
      {
        method: "DELETE"
      }
    );

    showToast(
      "تم حذف الطالب"
    );

    loadStudents();

  } catch (error) {

    showToast(
      error.message
    );

  }

};


/* =====================================================
   EMPLOYEES
===================================================== */

async function loadEmployees() {

  try {

    const data =
      await api("/api/employees");

    const employees =
      data.employees || [];

    const body =
      document.getElementById(
        "employeesTableBody"
      );

    if (!employees.length) {

      body.innerHTML =
        `<tr>
          <td colspan="9">
            لا توجد بيانات موظفين
          </td>
        </tr>`;

      return;
    }

    body.innerHTML =
      employees.map((employee, index) => {

        return `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              ${escapeHtml(employee.employee_no)}
            </td>

            <td>
              ${escapeHtml(employee.name)}
            </td>

            <td>
              ${escapeHtml(employee.job)}
            </td>

            <td>
              ${escapeHtml(employee.department)}
            </td>

            <td>
              ${escapeHtml(employee.phone)}
            </td>

            <td>
              ${Number(employee.salary).toLocaleString()}
            </td>

            <td>
              ${escapeHtml(employee.status)}
            </td>

            <td>

              <button
                class="btn btn-danger"
                onclick="deleteEmployee(${employee.id})"
              >
                حذف
              </button>

            </td>

          </tr>
        `;

      }).join("");

  } catch (error) {

    showToast(
      error.message
    );

  }

}


/* =====================================================
   ADD EMPLOYEE
===================================================== */

document
  .getElementById(
    "addEmployeeButton"
  )
  .addEventListener(
    "click",
    function() {

      openModal(
        "إضافة موظف",
        `
          <form id="addEmployeeForm">

            <div class="form-group">
              <label>رقم الموظف</label>
              <input id="employeeNo">
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
              <input
                id="employeeSalary"
                type="number"
                min="0"
              >
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


      document
        .getElementById(
          "addEmployeeForm"
        )
        .addEventListener(
          "submit",
          async function(event) {

            event.preventDefault();

            try {

              await api(
                "/api/employees",
                {
                  method: "POST",

                  body: JSON.stringify({

                    employee_no:
                      document
                        .getElementById(
                          "employeeNo"
                        )
                        .value.trim(),

                    name:
                      document
                        .getElementById(
                          "employeeName"
                        )
                        .value.trim(),

                    job:
                      document
                        .getElementById(
                          "employeeJob"
                        )
                        .value.trim(),

                    department:
                      document
                        .getElementById(
                          "employeeDepartment"
                        )
                        .value.trim(),

                    phone:
                      document
                        .getElementById(
                          "employeePhone"
                        )
                        .value.trim(),

                    salary:
                      Number(
                        document
                          .getElementById(
                            "employeeSalary"
                          )
                          .value
                      ) || 0

                  })

                }
              );

              closeModal();

              showToast(
                "تمت إضافة الموظف"
              );

              loadEmployees();

            } catch (error) {

              showToast(
                error.message
              );

            }

          }
        );

    }
  );


window.deleteEmployee =
async function(id) {

  if (!confirm(
    "هل تريد حذف الموظف؟"
  )) {
    return;
  }

  try {

    await api(
      `/api/employees/${id}`,
      {
        method: "DELETE"
      }
    );

    showToast(
      "تم حذف الموظف"
    );

    loadEmployees();

  } catch (error) {

    showToast(
      error.message
    );

  }

};


/* =====================================================
   ATTENDANCE
===================================================== */

async function loadAttendance() {

  try {

    const students =
      await api(
        "/api/attendance/students"
      );

    const studentBody =
      document.getElementById(
        "attendanceStudentsBody"
      );

    const list =
      students.students || [];

    if (!list.length) {

      studentBody.innerHTML =
        `<tr>
          <td colspan="4">
            لا توجد بيانات طلاب
          </td>
        </tr>`;

    } else {

      studentBody.innerHTML =
        list.map(student => {

          return `
            <tr>

              <td>
                ${escapeHtml(student.name)}
              </td>

              <td>
                ${escapeHtml(student.class_name)}
              </td>

              <td>
                ${escapeHtml(
                  student.attendance_status
                )}
              </td>

              <td>

                <button
                  class="btn btn-primary"
                  onclick="saveAttendance(${student.id}, 'حاضر')"
                >
                  حاضر
                </button>

                <button
                  class="btn btn-danger"
                  onclick="saveAttendance(${student.id}, 'غائب')"
                >
                  غائب
                </button>

              </td>

            </tr>
          `;

        }).join("");

    }


    const employees =
      await api(
        "/api/attendance/employees"
      );

    const employeeBody =
      document.getElementById(
        "attendanceEmployeesBody"
      );

    const attendance =
      employees.attendance || [];

    if (!attendance.length) {

      employeeBody.innerHTML =
        `<tr>
          <td colspan="6">
            لا توجد سجلات حضور للموظفين
          </td>
        </tr>`;

    } else {

      employeeBody.innerHTML =
        attendance.map(row => {

          return `
            <tr>

              <td>
                ${escapeHtml(row.name || "-")}
              </td>

              <td>
                ${escapeHtml(row.date || "-")}
              </td>

              <td>
                ${escapeHtml(row.check_in || "-")}
              </td>

              <td>
                ${escapeHtml(row.check_out || "-")}
              </td>

              <td>
                ${escapeHtml(row.status || "-")}
              </td>

              <td>
                ${row.late_minutes || 0}
              </td>

            </tr>
          `;

        }).join("");

    }

  } catch (error) {

    showToast(
      error.message
    );

  }

}


window.saveAttendance =
async function(studentId, status) {

  try {

    await api(
      "/api/attendance/students",
      {
        method: "POST",

        body: JSON.stringify({
          student_id: studentId,
          status
        })
      }
    );

    showToast(
      "تم تسجيل الحضور"
    );

    loadAttendance();

  } catch (error) {

    showToast(
      error.message
    );

  }

};


document
  .getElementById(
    "refreshStudentAttendance"
  )
  .addEventListener(
    "click",
    loadAttendance
  );


/* =====================================================
   PAYROLL
===================================================== */

async function loadPayroll() {

  try {

    const data =
      await api("/api/payroll");

    const payroll =
      data.payroll || [];

    const body =
      document.getElementById(
        "payrollTableBody"
      );

    if (!payroll.length) {

      body.innerHTML =
        `<tr>
          <td colspan="7">
            لا توجد بيانات رواتب
          </td>
        </tr>`;

      return;
    }

    body.innerHTML =
      payroll.map(row => {

        return `
          <tr>

            <td>
              ${escapeHtml(row.name)}
            </td>

            <td>
              ${money(row.basic)}
            </td>

            <td>
              ${money(row.allowances)}
            </td>

            <td>
              ${money(row.bonuses)}
            </td>

            <td>
              ${money(row.deductions)}
            </td>

            <td>
              <strong>
                ${money(row.net)}
              </strong>
            </td>

            <td>

              <button
                class="btn btn-secondary"
                onclick="editPayroll(
                  ${row.employee_id},
                  ${row.basic},
                  ${row.allowances},
                  ${row.bonuses},
                  ${row.deductions}
                )"
              >
                تعديل
              </button>

            </td>

          </tr>
        `;

      }).join("");

  } catch (error) {

    showToast(
      error.message
    );

  }

}


window.editPayroll =
function(
  employeeId,
  basic,
  allowances,
  bonuses,
  deductions
) {

  openModal(
    "إعداد الراتب",
    `
      <form id="payrollForm">

        <div class="form-group">
          <label>الأساسي</label>
          <input
            id="payBasic"
            type="number"
            value="${basic}"
          >
        </div>

        <div class="form-group">
          <label>البدلات</label>
          <input
            id="payAllowances"
            type="number"
            value="${allowances}"
          >
        </div>

        <div class="form-group">
          <label>المكافآت</label>
          <input
            id="payBonuses"
            type="number"
            value="${bonuses}"
          >
        </div>

        <div class="form-group">
          <label>الخصومات</label>
          <input
            id="payDeductions"
            type="number"
            value="${deductions}"
          >
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


  document
    .getElementById(
      "payrollForm"
    )
    .addEventListener(
      "submit",
      async function(event) {

        event.preventDefault();

        try {

          await api(
            "/api/payroll",
            {
              method: "POST",

              body: JSON.stringify({

                employee_id: employeeId,

                basic:
                  Number(
                    document
                      .getElementById(
                        "payBasic"
                      )
                      .value
                  ) || 0,

                allowances:
                  Number(
                    document
                      .getElementById(
                        "payAllowances"
                      )
                      .value
                  ) || 0,

                bonuses:
                  Number(
                    document
                      .getElementById(
                        "payBonuses"
                      )
                      .value
                  ) || 0,

                deductions:
                  Number(
                    document
                      .getElementById(
                        "payDeductions"
                      )
                      .value
                  ) || 0

              })

            }
          );

          closeModal();

          showToast(
            "تم حفظ الراتب"
          );

          loadPayroll();

        } catch (error) {

          showToast(
            error.message
          );

        }

      }
    );

};


/* =====================================================
   NOTES
===================================================== */

async function loadStudentsForNotes() {

  try {

    const data =
      await api("/api/students");

    const select =
      document.getElementById(
        "noteStudent"
      );

    const students =
      data.students || [];

    select.innerHTML =
      `<option value="">
        اختر الطالب
      </option>` +
      students.map(student => {

        return `
          <option value="${student.id}">
            ${escapeHtml(student.name)}
          </option>
        `;

      }).join("");

  } catch (error) {

    console.error(error);

  }

}


async function loadNotes() {

  try {

    const data =
      await api("/api/notes");

    const notes =
      data.notes || [];

    const body =
      document.getElementById(
        "notesTableBody"
      );

    if (!notes.length) {

      body.innerHTML =
        `<tr>
          <td colspan="4">
            لا توجد ملاحظات
          </td>
        </tr>`;

      return;
    }

    body.innerHTML =
      notes.map(note => {

        return `
          <tr>

            <td>
              ${escapeHtml(
                note.student_name || "-"
              )}
            </td>

            <td>
              ${escapeHtml(note.note)}
            </td>

            <td>
              ${formatDate(note.created_at)}
            </td>

            <td>

              <button
                class="btn btn-danger"
                onclick="deleteNote(${note.id})"
              >
                حذف
              </button>

            </td>

          </tr>
        `;

      }).join("");

  } catch (error) {

    showToast(
      error.message
    );

  }

}


document
  .getElementById(
    "saveNoteButton"
  )
  .addEventListener(
    "click",
    async function() {

      const studentId =
        document
          .getElementById(
            "noteStudent"
          )
          .value;

      const note =
        document
          .getElementById(
            "noteText"
          )
          .value.trim();

      if (!studentId || !note) {

        showToast(
          "اختر الطالب واكتب الملاحظة"
        );

        return;
      }

      try {

        await api(
          "/api/notes",
          {
            method: "POST",

            body: JSON.stringify({

              student_id:
                Number(studentId),

              note

            })

          }
        );

        document
          .getElementById(
            "noteText"
          )
          .value = "";

        showToast(
          "تم حفظ الملاحظة"
        );

        loadNotes();

      } catch (error) {

        showToast(
          error.message
        );

      }

    }
  );


window.deleteNote =
async function(id) {

  if (!confirm(
    "هل تريد حذف الملاحظة؟"
  )) {
    return;
  }

  try {

    await api(
      `/api/notes/${id}`,
      {
        method: "DELETE"
      }
    );

    showToast(
      "تم حذف الملاحظة"
    );

    loadNotes();

  } catch (error) {

    showToast(
      error.message
    );

  }

};


/* =====================================================
   VIDEOS
===================================================== */

async function loadVideos() {

  try {

    const data =
      await api("/api/videos");

    const videos =
      data.videos || [];

    const grid =
      document.getElementById(
        "videosGrid"
      );

    if (!videos.length) {

      grid.innerHTML =
        `
          <div class="card">
            لا توجد حصص مضافة حتى الآن.
          </div>
        `;

      return;
    }

    grid.innerHTML =
      videos.map(video => {

        return `
          <div class="card">

            <h3>
              ${escapeHtml(video.title)}
            </h3>

            <p>
              ${escapeHtml(video.subject || "")}
            </p>

            <p>
              ${escapeHtml(video.description || "")}
            </p>

            ${
              video.url
                ? `
                  <a
                    href="${escapeHtml(video.url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-primary"
                  >
                    ▶ مشاهدة الحصة
                  </a>
                `
                : ""
            }

            <button
              class="btn btn-danger"
              onclick="deleteVideo(${video.id})"
              style="margin-top:10px"
            >
              حذف
            </button>

          </div>
        `;

      }).join("");

  } catch (error) {

    showToast(
      error.message
    );

  }

}


/* =====================================================
   ADD VIDEO
===================================================== */

document
  .getElementById(
    "addVideoButton"
  )
  .addEventListener(
    "click",
    function() {

      openModal(
        "إضافة حصة",
        `
          <form id="videoForm">

            <div class="form-group">
              <label>عنوان الحصة</label>
              <input
                id="videoTitle"
                required
              >
            </div>

            <div class="form-group">
              <label>المادة</label>
              <input id="videoSubject">
            </div>

            <div class="form-group">
              <label>رابط الفيديو</label>
              <input
                id="videoUrl"
                type="url"
                placeholder="https://..."
              >
            </div>

            <div class="form-group">
              <label>الوصف</label>
              <textarea
                id="videoDescription"
              ></textarea>
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


      document
        .getElementById(
          "videoForm"
        )
        .addEventListener(
          "submit",
          async function(event) {

            event.preventDefault();

            try {

              await api(
                "/api/videos",
                {
                  method: "POST",

                  body: JSON.stringify({

                    title:
                      document
                        .getElementById(
                          "videoTitle"
                        )
                        .value.trim(),

                    subject:
                      document
                        .getElementById(
                          "videoSubject"
                        )
                        .value.trim(),

                    url:
                      document
                        .getElementById(
                          "videoUrl"
                        )
                        .value.trim(),

                    description:
                      document
                        .getElementById(
                          "videoDescription"
                        )
                        .value.trim()

                  })

                }
              );

              closeModal();

              showToast(
                "تمت إضافة الحصة"
              );

              loadVideos();

            } catch (error) {

              showToast(
                error.message
              );

            }

          }
        );

    }
  );


window.deleteVideo =
async function(id) {

  if (!confirm(
    "هل تريد حذف الحصة؟"
  )) {
    return;
  }

  try {

    await api(
      `/api/videos/${id}`,
      {
        method: "DELETE"
      }
    );

    showToast(
      "تم حذف الحصة"
    );

    loadVideos();

  } catch (error) {

    showToast(
      error.message
    );

  }

};


/* =====================================================
   LOGS
===================================================== */

async function loadLogs() {

  try {

    const data =
      await api("/api/logs");

    const logs =
      data.logs || [];

    const body =
      document.getElementById(
        "logsTableBody"
      );

    if (!logs.length) {

      body.innerHTML =
        `<tr>
          <td colspan="5">
            لا توجد عمليات
          </td>
        </tr>`;

      return;
    }

    body.innerHTML =
      logs.map((log, index) => {

        return `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              ${escapeHtml(
                log.username
              )}
            </td>

            <td>
              ${escapeHtml(
                log.action
              )}
            </td>

            <td>
              ${escapeHtml(
                log.details
              )}
            </td>

            <td>
              ${formatDate(
                log.created_at
              )}
            </td>

          </tr>
        `;

      }).join("");

  } catch (error) {

    showToast(
      error.message
    );

  }

}


document
  .getElementById(
    "refreshLogs"
  )
  .addEventListener(
    "click",
    loadLogs
  );


/* =====================================================
   REFRESH DASHBOARD
===================================================== */

document
  .getElementById(
    "refreshDashboard"
  )
  .addEventListener(
    "click",
    loadDashboard
  );


/* =====================================================
   PAYROLL SETTINGS
===================================================== */

document
  .getElementById(
    "payrollSettingsButton"
  )
  .addEventListener(
    "click",
    function() {

      showToast(
        "إعدادات الرواتب جاهزة للتطوير"
      );

    }
  );


/* =====================================================
   MODAL
===================================================== */

const modal =
  document.getElementById(
    "modal"
  );

const modalTitle =
  document.getElementById(
    "modalTitle"
  );

const modalBody =
  document.getElementById(
    "modalBody"
  );

const modalClose =
  document.getElementById(
    "modalClose"
  );


function openModal(title, body) {

  modalTitle.textContent =
    title;

  modalBody.innerHTML =
    body;

  modal.classList.remove(
    "hidden"
  );

}


function closeModal() {

  modal.classList.add(
    "hidden"
  );

  modalBody.innerHTML =
    "";

}


modalClose.addEventListener(
  "click",
  closeModal
);


document
  .querySelector(".modal-overlay")
  .addEventListener(
    "click",
    closeModal
  );


/* =====================================================
   MENU BUTTON
===================================================== */

const menuButton =
  document.getElementById(
    "menuButton"
  );

const sidebar =
  document.getElementById(
    "sidebar"
  );


menuButton.addEventListener(
  "click",
  function() {

    if (
      sidebar.style.display ===
      "none"
    ) {

      sidebar.style.display =
        "";

    } else {

      sidebar.style.display =
        "none";

    }

  }
);


/* =====================================================
   HELPERS
===================================================== */

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


function formatDate(value) {

  if (!value) {
    return "-";
  }

  try {

    return new Date(
      value
    ).toLocaleString(
      "ar-EG"
    );

  } catch (error) {

    return value;

  }

}


function money(value) {

  return Number(
    value || 0
  ).toLocaleString(
    "ar-EG"
  );

}


/* =====================================================
   AUTO LOGIN SESSION
===================================================== */

if (currentUser) {

  enterApplication();

} else {

  loginPage.classList.remove(
    "hidden"
  );

  appPage.classList.add(
    "hidden"
  );

}


/* =====================================================
   KEEP ONLINE
===================================================== */

setInterval(
  async function() {

    if (!currentUser) {
      return;
    }

    try {

      await api(
        "/api/login",
        {
          method: "POST",

          body: JSON.stringify({

            username:
              currentUser.username,

            password:
              ""

          })
        }
      );

    } catch (error) {

      /* لا نفعل شيئاً */

    }

  },
  5 * 60 * 1000
);
