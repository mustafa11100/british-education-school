const loginForm = document.getElementById("loginForm");
const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");
const loginMessage = document.getElementById("loginMessage");

let currentUser = null;

loginForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  const username =
    document.getElementById("username").value.trim();

  const password =
    document.getElementById("password").value;

  if (!username || !password) {
    loginMessage.textContent =
      "أدخل اسم المستخدم وكلمة المرور";

    return;
  }

  loginMessage.textContent =
    "جاري تسجيل الدخول...";

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

    const data = await response.json();

    if (!response.ok) {

      loginMessage.textContent =
        data.error || "بيانات الدخول غير صحيحة";

      return;
    }

    currentUser = data;

    localStorage.setItem(
      "schoolUser",
      JSON.stringify(data)
    );

    loginPage.classList.add("hidden");

    appPage.classList.remove("hidden");

    const currentUserName =
      document.getElementById("currentUserName");

    if (currentUserName) {
      currentUserName.textContent =
        data.name;
    }

    loginMessage.textContent = "";

    startActivity();

    loadDashboard();

  } catch (error) {

    console.error(error);

    loginMessage.textContent =
      "تعذر الاتصال بالسيرفر";

  }

});
