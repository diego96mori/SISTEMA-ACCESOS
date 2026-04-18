const NETBOX_URL = "http://172.16.29.91:8484/api";
const TOKEN = "bs49cKrnuP1pzzVekkpo16i6rphqLE1YiSDyZSQB"; // el que ya te funcionó

export async function netboxGet(endpoint) {
  const res = await fetch(`${NETBOX_URL}${endpoint}`, {
    headers: {
      "Authorization": `Token ${TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  return res.json();
}