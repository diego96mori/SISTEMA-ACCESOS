const NETBOX_URL = "http://172.16.29.91:8484/api";
const TOKEN = "bs49cKrnuP1pzzVekkpo16i6rphqLE1YiSDyZSQB";

/* ===================================== */
/* GET */
/* ===================================== */

export async function netboxGet(endpoint) {

  const res = await fetch(
    `${NETBOX_URL}${endpoint}`,
    {
      headers: {
        "Authorization": `Token ${TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );

  if (!res.ok) {

    throw new Error(
      "Error GET NetBox"
    );
  }

  return res.json();
}

/* ===================================== */
/* PATCH */
/* ===================================== */

export async function netboxPatch(
  endpoint,
  body
) {

  const response = await fetch(

    `${NETBOX_URL}${endpoint}`,

    {
      method: "PATCH",

      headers: {
        "Authorization": `Token ${TOKEN}`,
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {

    throw new Error(
      "Error PATCH NetBox"
    );
  }

  return response.json();
}

/* ===================================== */
/* DELETE */
/* ===================================== */

export async function netboxDelete(
  endpoint
) {

  const response = await fetch(

    `${NETBOX_URL}${endpoint}`,

    {
      method: "DELETE",

      headers: {
        "Authorization":
          `Token ${TOKEN}`
      }
    }
  );

  if (!response.ok) {

    throw new Error(
      "Error DELETE NetBox"
    );
  }

  return true;
}