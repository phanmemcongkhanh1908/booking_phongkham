import axios from 'axios';
async function run() {
  try {
    // We need a token.
    const login = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'admin@dentalsmartbooking.com',
      password: 'admin' // Wait, I don't know the password. It's an argon2 hash.
    });
    console.log(login.data);
  } catch(e) {
    console.error(e.response?.data || e.message);
  }
}
run();
