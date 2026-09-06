import { GoogleAuth } from 'google-auth-library';
async function test() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  console.log("Token:", token.token ? "Exists" : "None");
}
test();
