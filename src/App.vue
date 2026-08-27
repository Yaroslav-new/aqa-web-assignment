<template>
  <div id="app">
    <header v-if="isLoggedIn">
      <nav class="navigation">
        <section class="menu">
          <div class="home">
            <i class="fas fa-home"></i>
            Home
          </div>
          <div class="products">
            <i class="fas fa-tag"></i>
            Products
          </div>
          <div class="contact">
            <i class="fas fa-envelope"></i>
            Contact
          </div>
        </section>
        <section class="user">
          <div class="user-section" @click="toggleLogout">
            <i class="fas fa-user-circle"></i>
            <div class="logout" v-if="showLogoutMenu" @click.stop="logOut">
              <span>Sign Out
                <i class="fas fa-sign-out-alt"></i>
              </span>
            </div>
          </div>
          <button class="btn-logout" @click="logOut">
            <i class="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </section>
      </nav>
    </header>

    <main>
      <section class="login" v-if="!isLoggedIn">
        <h1 style="background-color:darkolivegreen;">Automation doesn't stop at testing, it's just a beginning!</h1>
        <form @submit.prevent="logIn">
          <fieldset>
            <div v-if="errorMessage" class="error-message">
              {{ errorMessage }}
            </div>
            <label for="email">User</label>
            <input
              type="text"
              id="email"
              v-model="email"
              placeholder="E-mail address"
              autofocus
              @input="clearError"
            ><br>

            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              v-model="password"
              @input="clearError"
            >

            <input type="submit" class="btn-login" value="LOGIN">
          </fieldset>
        </form>
      </section>

      <section class="content" v-if="isLoggedIn">
        <div class="div-container">
          <p>
            Lorem ipsum egestas posuere vivamus neque facilisis augue cursus litora rhoncus aenean aptent eu quis, odio scelerisque curabitur rhoncus sociosqu velit curae ipsum duis porttitor rhoncus amet.
            consectetur nostra massa molestie sed imperdiet nulla mauris in cras mauris lobortis feugiat, quis sem sagittis tortor diam vehicula habitant primis ultricies platea et.
            amet aliquet nisi proin volutpat sapien eget, tincidunt nisl neque habitant tellus, mi commodo congue habitasse est.
            etiam imperdiet quisque sociosqu vivamus ut libero nibh fames, nullam eleifend adipiscing iaculis faucibus nulla dolor varius, curae sollicitudin habitant aliquet nam quis neque.
          </p>
          <p>
            Tempus ultrices euismod eros libero posuere aliquam dui dictum hac integer, orci pretium aptent pellentesque aenean conubia vulputate orci rutrum neque phasellus, netus risus tellus nullam aenean tristique tempor donec nisl.
            habitant purus et luctus faucibus at pretium integer feugiat, felis pulvinar ut accumsan quisque fermentum non, curabitur purus egestas eu lobortis posuere feugiat.
            velit enim ultricies sollicitudin scelerisque sit vivamus nisi, tortor massa neque pretium cursus curabitur nullam dapibus, sem tristique elit adipiscing curabitur consequat.
            elit mi sagittis elit ad sociosqu erat vitae etiam curabitur platea, tincidunt pellentesque euismod quis feugiat sagittis vehicula rutrum inceptos, sociosqu donec imperdiet aenean eleifend auctor mauris arcu vestibulum.
          </p>
          <p>
            Mauris aptent nunc per sociosqu placerat nisi sociosqu accumsan fermentum, habitant lacus massa metus cras malesuada rhoncus ut, imperdiet et taciti malesuada mollis tincidunt etiam quis.
            est non laoreet dictum senectus fames velit nulla mi, nam ipsum scelerisque sodales tellus ligula enim leo proin, lectus sodales platea feugiat condimentum donec orci.
            nisi potenti cras curae sollicitudin fames semper at morbi magna aenean donec, sodales cursus justo phasellus consequat congue luctus leo proin.
            sagittis dapibus viverra maecenas porta gravida, fermentum quisque donec porttitor, sit posuere ullamcorper lacinia.
            ac odio et nulla nisi potenti aliquet tristique, ac netus accumsan quis tortor non arcu cubilia, ante nec varius pretium justo donec.
          </p>
        </div>
      </section>
    </main>

    <footer>
      <p>Thank you for participating!</p>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      email: '',
      password: '',
      isLoggedIn: false,
      showLogoutMenu: false,
      errorMessage: '',
      users: [
        { email: 'admin@admin.com', password: '2020' },
        { email: 'biancunha@gmail.com', password: '123456' },
        { email: 'growdev@growdev.com.br', password: 'growdev123' }
      ]
    }
  },
  methods: {
    logIn() {
      const user = this.users.find(u => u.email === this.email && u.password === this.password);
      if (user) {
        localStorage.setItem('logged', user.email);
        this.email = '';
        this.password = '';
        this.errorMessage = '';
        this.checkLogged();
      } else {
        this.errorMessage = 'Invalid email or password. Please try again.';
      }
    },
    logOut() {
      localStorage.removeItem('logged');
      this.showLogoutMenu = false;
      this.checkLogged();
    },
    toggleLogout() {
      this.showLogoutMenu = !this.showLogoutMenu;
    },
    clearError() {
      this.errorMessage = '';
    },
    checkLogged() {
      const logged = localStorage.getItem('logged');
      this.isLoggedIn = !!logged;
      if (logged) {
        console.log(`User logged: ${logged}`);
      }
    }
  },
  mounted() {
    this.checkLogged();
  }
}
</script>

<style scoped>
@import '../css/style.css';
</style>

