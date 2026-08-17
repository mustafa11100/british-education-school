const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");

const currentUserName = document.getElementById("currentUserName");
const logoutButton = document.getElementById("logoutButton");

let currentUser = null;


/* =====================================================
   LOGIN
===================================================== */

loginForm.addEventListener("submit", async function (event) {

  event.preventDefault();

  const username =
    document.getElementById("username").value.trim();

  const password =
    document.getElementById("password").value;

  loginMessage.textContent = "جاري تسجيل الدخول...";

  try {

    const response = await fetch("/api/login", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        username,
        password
      })
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        error: text || "استجابة غير صحيحة من السيرفر"
      };
    }

    if (!response.ok) {

      loginMessage.textContent =
        data.error || `خطأ HTTP ${response.status}`;

      return;
    }

    if (!data.success || !data.user) {

      loginMessage.textContent =
        "تعذر تسجيل الدخول";

      return;
    }

    currentUser = data.user;

    localStorage.setItem(
      "schoolUser",
      JSON.stringify(currentUser)
    );

    loginMessage.textContent = "";

    showApplication();

  } catch (error) {

    console.error("LOGIN ERROR:", error);

    loginMessage.textContent =
      "تعذر الاتصال بالسيرفر";
  }

});


/* =====================================================
   SHOW APPLICATION
===================================================== */

function showApplication() {

  loginPage.classList.add("hidden");

  appPage.classList.remove("hidden");

  if (currentUserName) {
    currentUserName.textContent =
      currentUser.name || currentUser.username;
  }

  loadDashboard();

}


/* =====================================================
   LOGOUT
===================================================== */

logoutButton.addEventListener("click", async function () {

  try {

    if (currentUser) {

      await fetch("/api/logout", {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          userId: currentUser.id
        })
      });

    }

  } catch (error) {
    console.error(error);
  }

  localStorage.removeItem("schoolUser");

  currentUser = null;

  appPage.classList.add("hidden");

  loginPage.classList.remove("hidden");

  document.getElementById("loginForm").reset();

});


/* =====================================================
   DASHBOARD
===================================================== */

async function loadDashboard() {

  try {

    const response =
      await fetch("/api/dashboard");

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `HTTP ${response.status}`
      );
    }

    document.getElementById("statUsers").textContent =
      data.stats.users;

    document.getElementById("statOnline").textContent =
      data.stats.online;

    document.getElementById("statStudents").textContent =
      data.stats.students;

    document.getElementById("statEmployees").textContent =
      data.stats.employees;


    const health =
      document.getElementById("healthStatus");

    if (health) {

      health.innerHTML =
        "🟢 النظام يعمل بشكل طبيعي";
    }


    const list =
      document.getElementById("onlineUsersList");

    if (!list) return;


    if (!data.onlineUsers.length) {

      list.textContent =
        "لا يوجد مستخدمون متصلون الآن";

      return;
    }


    list.innerHTML =
      data.onlineUsers.map(user => `
        <div style="
          padding:10px;
          border-bottom:1px solid #eee;
        ">
          🟢
          <strong>${escapeHtml(user.name)}</strong>
          <small>
            (${escapeHtml(user.username)})
          </small>
        </div>
      `).join("");


  } catch (error) {

    console.error(error);

    const health =
      document.getElementById("healthStatus");

    if (health) {

      health.textContent =
        "🔴 تعذر الاتصال ببيانات النظام";
    }

  }

}


/* =====================================================
   NAVIGATION
===================================================== */

document
  .querySelectorAll(".nav-item")
  .forEach(button => {

    button.addEventListener("click", function () {

      const page =
        this.dataset.page;

      document
        .querySelectorAll(".nav-item")
        .forEach(item =>
          item.classList.remove("active")
        );

      this.classList.add("active");


      document
        .querySelectorAll(".page-section")
        .forEach(section =>
          section.classList.add("hidden")
        );


      const target =
        document.getElementById(
          "page-" + page
        );

      if (target) {
        target.classList.remove("hidden");
      }


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
      }

      if (page === "videos") {
        loadVideos();
      }

      if (page === "logs") {
        loadLogs();
      }

    });

  });


/* =====================================================
   USERS
===================================================== */

async function loadUsers() {

  try {

    const response =
      await fetch("/api/users");

    const data =
      await response.json();

    const body =
      document.getElementById("usersTableBody");

    if (!body) return;

    body.innerHTML = "";

    data.users.forEach((user, index) => {

      body.innerHTML += `
        <tr>

          <td>${index + 1}</td>

          <td>${escapeHtml(user.username)}</td>

          <td>${escapeHtml(user.name)}</td>

          <td>
            ${user.role === "admin"
              ? "مدير"
              : "مستخدم"}
          </td>

          <td>
            ${user.active
              ? "🟢 نشط"
              : "🔴 موقوف"}
          </td>

          <td>
            ${user.online
              ? "🟢 متصل الآن"
              : formatDate(user.last_seen)}
          </td>

          <td>

            ${
              user.username !== "admin"
              ? `
                <button
                  class="btn btn-secondary"
                  onclick="toggleUser(
                    ${user.id},
                    ${user.active ? 0 : 1}
                  )"
                >
                  ${user.active ? "إيقاف" : "تفعيل"}
                </button>

                <button
                  class="btn btn-danger"
                  onclick="deleteUser(${user.id})"
                >
                  حذف
                </button>
              `
              : "المدير الرئيسي"
            }

          </td>

        </tr>
      `;

    });


    document.getElementById("usersTotal").textContent =
      data.users.length;

    document.getElementById("usersActive").textContent =
      data.users.filter(u => u.active).length;

    document.getElementById("usersOnline").textContent =
      data.users.filter(u => u.online).length;

  } catch (error) {

    console.error(error);

  }

}


async function toggleUser(id, active) {

  await fetch(`/api/users/${id}/status`, {

    method: "PATCH",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      active: Boolean(active)
    })

  });

  loadUsers();
  loadDashboard();
}


async function deleteUser(id) {

  if (!confirm("هل تريد حذف المستخدم؟")) {
    return;
  }

  await fetch(`/api/users/${id}`, {
    method: "DELETE"
  });

  loadUsers();
  loadDashboard();
}


/* =====================================================
   REGISTER
===================================================== */

const registerForm =
  document.getElementById("registerForm");

const showRegisterButton =
  document.getElementById("showRegisterButton");

const backToLoginButton =
  document.getElementById("backToLoginButton");

const loginBox =
  document.getElementById("loginBox");

const registerBox =
  document.getElementById("registerBox");

const registerMessage =
  document.getElementById("registerMessage");


showRegisterButton.addEventListener("click", () => {

  loginBox.classList.add("hidden");

  registerBox.classList.remove("hidden");

  registerMessage.textContent = "";

});


backToLoginButton.addEventListener("click", () => {

  registerBox.classList.add("hidden");

  loginBox.classList.remove("hidden");

  registerMessage.textContent = "";

});


registerForm.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();

    const name =
      document.getElementById("registerName").value.trim();

    const username =
      document.getElementById("registerUsername").value.trim();

    const password =
      document.getElementById("registerPassword").value;

    const confirmPassword =
      document
        .getElementById("registerPasswordConfirm")
        .value;


    if (!name || !username || !password) {

      registerMessage.textContent =
        "أكمل جميع البيانات";

      return;
    }


    if (password.length < 4) {

      registerMessage.textContent =
        "كلمة المرور يجب أن تكون 4 أحرف على الأقل";

      return;
    }


    if (password !== confirmPassword) {

      registerMessage.textContent =
        "كلمتا المرور غير متطابقتين";

      return;
    }


    registerMessage.textContent =
      "جاري إنشاء الحساب...";


    try {

      const response =
        await fetch("/api/users", {

          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            username,
            password,
            name,
            role: "user"
          })

        });


      const data =
        await response.json();


      if (!response.ok) {

        registerMessage.textContent =
          data.error ||
          `خطأ HTTP ${response.status}`;

        return;
      }


      registerMessage.textContent =
        "تم إنشاء الحساب بنجاح ✅";

      registerForm.reset();


      setTimeout(() => {

        registerBox.classList.add("hidden");

        loginBox.classList.remove("hidden");

        document.getElementById("username").value =
          username;

        document.getElementById("password").value =
          "";

        registerMessage.textContent = "";

      }, 1000);


    } catch (error) {

      console.error(error);

      registerMessage.textContent =
        "تعذر الاتصال بالسيرفر";

    }

  }
);


/* =====================================================
   STUDENTS
===================================================== */

async function loadStudents() {

  try {

    const response =
      await fetch("/api/students");

    const data =
      await response.json();

    const body =
      document.getElementById("studentsTableBody");

    body.innerHTML = "";

    data.students.forEach((student, index) => {

      body.innerHTML += `
        <tr>

          <td>${index + 1}</td>

          <td>${escapeHtml(student.name)}</td>

          <td>${escapeHtml(student.class_name)}</td>

          <td>${escapeHtml(student.parent_phone)}</td>

          <td>${escapeHtml(student.status)}</td>

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

    });

    fillStudentSelect(data.students);

  } catch (error) {

    console.error(error);

  }

}


function fillStudentSelect(students) {

  const select =
    document.getElementById("noteStudent");

  if (!select) return;

  select.innerHTML =
    `<option value="">اختر الطالب</option>`;

  students.forEach(student => {

    select.innerHTML += `
      <option value="${student.id}">
        ${escapeHtml(student.name)}
      </option>
    `;

  });

}


async function deleteStudent(id) {

  if (!confirm("هل تريد حذف الطالب؟")) {
    return;
  }

  await fetch(`/api/students/${id}`, {
    method: "DELETE"
  });

  loadStudents();
  loadDashboard();

}


/* =====================================================
   EMPLOYEES
===================================================== */

async function loadEmployees() {

  const response =
    await fetch("/api/employees");

  const data =
    await response.json();

  const body =
    document.getElementById("employeesTableBody");

  body.innerHTML = "";

  data.employees.forEach((employee, index) => {

    body.innerHTML += `
      <tr>

        <td>${index + 1}</td>

        <td>${escapeHtml(employee.employee_no)}</td>

        <td>${escapeHtml(employee.name)}</td>

        <td>${escapeHtml(employee.job)}</td>

        <td>${escapeHtml(employee.department)}</td>

        <td>${escapeHtml(employee.phone)}</td>

        <td>${employee.salary}</td>

        <td>${escapeHtml(employee.status)}</td>

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

  });

}


async function deleteEmployee(id) {

  if (!confirm("هل تريد حذف الموظف؟")) {
    return;
  }

  await fetch(`/api/employees/${id}`, {
    method: "DELETE"
  });

  loadEmployees();
  loadDashboard();

}


/* =====================================================
   ATTENDANCE
===================================================== */

async function loadAttendance() {

  const students =
    await fetch("/api/attendance/students")
      .then(r => r.json());

  const studentBody =
    document.getElementById(
      "attendanceStudentsBody"
    );

  studentBody.innerHTML = "";

  students.students.forEach(student => {

    studentBody.innerHTML += `
      <tr>

        <td>${escapeHtml(student.name)}</td>

        <td>${escapeHtml(student.class_name)}</td>

        <td>${escapeHtml(student.attendance_status)}</td>

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

  });


  const employees =
    await fetch("/api/attendance/employees")
      .then(r => r.json());

  const employeeBody =
    document.getElementById(
      "attendanceEmployeesBody"
    );

  employeeBody.innerHTML = "";

  employees.attendance.forEach(row => {

    employeeBody.innerHTML += `
      <tr>

        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.check_in)}</td>
        <td>${escapeHtml(row.check_out)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>${row.late_minutes || 0}</td>

      </tr>
    `;

  });

}


async function saveAttendance(studentId, status) {

  await fetch("/api/attendance/students", {

    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      student_id: studentId,
      status
    })

  });

  loadAttendance();

}


/* =====================================================
   PAYROLL
===================================================== */

async function loadPayroll() {

  const response =
    await fetch("/api/payroll");

  const data =
    await response.json();

  const body =
    document.getElementById("payrollTableBody");

  body.innerHTML = "";

  data.payroll.forEach(row => {

    body.innerHTML += `
      <tr>

        <td>${escapeHtml(row.name)}</td>

        <td>${row.basic}</td>

        <td>${row.allowances}</td>

        <td>${row.bonuses}</td>

        <td>${row.deductions}</td>

        <td>
          <strong>${row.net}</strong>
        </td>

        <td>
          <button
            class="btn btn-secondary"
            onclick="editPayroll(${row.employee_id})"
          >
            تعديل
          </button>
        </td>

      </tr>
    `;

  });

}


function editPayroll(employeeId) {

  alert(
    "يمكن تعديل بيانات الراتب من خلال إعدادات الرواتب."
  );

}


/* =====================================================
   NOTES
===================================================== */

async function loadNotes() {

  const response =
    await fetch("/api/notes");

  const data =
    await response.json();

  const body =
    document.getElementById("notesTableBody");

  body.innerHTML = "";

  data.notes.forEach(note => {

    body.innerHTML += `
      <tr>

        <td>${escapeHtml(note.student_name)}</td>

        <td>${escapeHtml(note.note)}</td>

        <td>${formatDate(note.created_at)}</td>

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

  });

}


document
  .getElementById("saveNoteButton")
  .addEventListener("click", async () => {

    const student_id =
      document.getElementById("noteStudent").value;

    const note =
      document.getElementById("noteText").value.trim();


    if (!student_id || !note) {

      alert("اختر الطالب واكتب الملاحظة");

      return;
    }


    await fetch("/api/notes", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        student_id,
        note
      })

    });


    document.getElementById("noteText").value = "";

    loadNotes();

  });


async function deleteNote(id) {

  await fetch(`/api/notes/${id}`, {
    method: "DELETE"
  });

  loadNotes();

}


/* =====================================================
   VIDEOS
===================================================== */

async function loadVideos() {

  const response =
    await fetch("/api/videos");

  const data =
    await response.json();

  const grid =
    document.getElementById("videosGrid");

  grid.innerHTML = "";

  data.videos.forEach(video => {

    grid.innerHTML += `
      <div class="card">

        <h3>
          ${escapeHtml(video.title)}
        </h3>

        <p>
          ${escapeHtml(video.subject)}
        </p>

        <p>
          ${escapeHtml(video.description)}
        </p>

        ${
          video.url
          ? `
            <a
              href="${escapeHtml(video.url)}"
              target="_blank"
              class="btn btn-primary"
            >
              مشاهدة الحصة
            </a>
          `
          : ""
        }

        <button
          class="btn btn-danger"
          onclick="deleteVideo(${video.id})"
        >
          حذف
        </button>

      </div>
    `;

  });

}


async function deleteVideo(id) {

  if (!confirm("هل تريد حذف الحصة؟")) {
    return;
  }

  await fetch(`/api/videos/${id}`, {
    method: "DELETE"
  });

  loadVideos();

}


/* =====================================================
   LOGS
===================================================== */

async function loadLogs() {

  const response =
    await fetch("/api/logs");

  const data =
    await response.json();

  const body =
    document.getElementById("logsTableBody");

  body.innerHTML = "";

  data.logs.forEach((log, index) => {

    body.innerHTML += `
      <tr>

        <td>${index + 1}</td>

        <td>${escapeHtml(log.username)}</td>

        <td>${escapeHtml(log.action)}</td>

        <td>${escapeHtml(log.details)}</td>

        <td>${formatDate(log.created_at)}</td>

      </tr>
    `;

  });

}


/* =====================================================
   REFRESH BUTTONS
===================================================== */

document
  .getElementById("refreshDashboard")
  ?.addEventListener(
    "click",
    loadDashboard
  );

document
  .getElementById("refreshLogs")
  ?.addEventListener(
    "click",
    loadLogs
  );

document
  .getElementById("refreshStudentAttendance")
  ?.addEventListener(
    "click",
    loadAttendance
  );


/* =====================================================
   RESTORE LOGIN
===================================================== */

const savedUser =
  localStorage.getItem("schoolUser");

if (savedUser) {

  try {

    currentUser =
      JSON.parse(savedUser);

    showApplication();

  } catch {

    localStorage.removeItem("schoolUser");

  }

}


/* =====================================================
   HELPERS
===================================================== */

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function formatDate(value) {

  if (!value) {
    return "—";
  }

  try {

    return new Date(value)
      .toLocaleString("ar-EG");

  } catch {

    return value;

  }

}
