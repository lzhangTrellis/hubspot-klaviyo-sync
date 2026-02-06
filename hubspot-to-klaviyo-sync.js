// hubspot-to-klaviyo-full-sync.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/* ================= CONFIG ================= */

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;

// GitHub Actions variable (empty = full sync)
const LAST_SYNC_AT = process.env.LAST_SYNC_AT
  ? new Date(process.env.LAST_SYNC_AT)
  : null;

const HUBSPOT_BASE = 'https://api.hubapi.com';
const KLAVIYO_BASE = 'https://a.klaviyo.com/api';

const FORM_TO_LIST_MAP = {
  'Unific Customer Tracking Form': 'UWRCeP',
  'Primary Quote Request Form': 'VmLDWk',
  'Weld Testing Services Request Form': 'SFBsHf',
  'Email Newsletter Subscription via Website - Footer Embed': 'WW6wxH',
  'Contact': 'Y5umh4',
  'Education Discount Verification': 'TQM3zE',
  'Credit Application Form': 'Ws5JrU',
};

/* ================= HEADERS ================= */

const hubspotHeaders = {
  Authorization: `Bearer ${HUBSPOT_TOKEN}`,
  'Content-Type': 'application/json',
};

const klaviyoHeaders = {
  Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
  'Content-Type': 'application/json',
  revision: '2024-10-15',
};

/* ================= UTIL ================= */

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withBackoff(fn, retries = 5) {
  try {
    return await fn();
  } catch (err) {
    const status = err.response?.status;
    if ((status === 429 || status >= 500) && retries > 0) {
      const wait = (6 - retries) * 1000;
      console.warn(`⏳ Rate limited. Retrying in ${wait}ms`);
      await sleep(wait);
      return withBackoff(fn, retries - 1);
    }
    throw err;
  }
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/* ================= HUBSPOT ================= */

async function fetchContactsSince(lastSync) {
  let contacts = [];
  let after;

  do {
    const res = await withBackoff(() =>
      axios.post(
        `${HUBSPOT_BASE}/crm/v3/objects/contacts/search`,
        {
          filterGroups: lastSync
            ? [
                {
                  filters: [
                    {
                      propertyName: 'createdate',
                      operator: 'GT',
                      value: lastSync.toISOString(),
                    },
                  ],
                },
              ]
            : [],
          properties: ['email', 'firstname', 'lastname', 'phone', 'company'],
          limit: 100,
          after,
        },
        { headers: hubspotHeaders }
      )
    );

    contacts.push(...res.data.results);
    after = res.data.paging?.next?.after;
  } while (after);

  return contacts;
}

async function fetchContactForms(contactId) {
  const res = await withBackoff(() =>
    axios.get(
      `${HUBSPOT_BASE}/contacts/v1/contact/vid/${contactId}/profile`,
      { headers: hubspotHeaders }
    )
  );

  return res.data['form-submissions'] || [];
}

/* ================= KLAVIYO ================= */

async function upsertProfile(contact) {
  try {
    const res = await withBackoff(() =>
      axios.post(
        `${KLAVIYO_BASE}/profiles/`,
        {
          data: {
            type: 'profile',
            attributes: {
              email: contact.email,
              first_name: contact.firstName,
              last_name: contact.lastName,
              phone_number: contact.phone,
              organization: contact.company,
            },
          },
        },
        { headers: klaviyoHeaders }
      )
    );

    return res.data.data.id;
  } catch (err) {
    if (err.response?.status === 409) {
      const lookup = await withBackoff(() =>
        axios.get(`${KLAVIYO_BASE}/profiles/`, {
          headers: klaviyoHeaders,
          params: {
            filter: `equals(email,"${contact.email}")`,
          },
        })
      );

      return lookup.data.data?.[0]?.id;
    }
    throw err;
  }
}

async function batchAddToList(listId, profileIds) {
  const batches = chunk(profileIds, 1000);

  for (const batch of batches) {
    await withBackoff(() =>
      axios.post(
        `${KLAVIYO_BASE}/lists/${listId}/relationships/profiles/`,
        {
          data: batch.map(id => ({
            type: 'profile',
            id,
          })),
        },
        { headers: klaviyoHeaders }
      )
    );

    console.log(`   ➕ Added ${batch.length} profiles to list ${listId}`);
  }
}

/* ================= RUN ================= */

(async () => {
  const startTime = Date.now();

  try {
    console.log(
      LAST_SYNC_AT
        ? `🔁 Incremental sync since ${LAST_SYNC_AT.toISOString()}`
        : '🆕 Initial full sync'
    );

    const contacts = await fetchContactsSince(LAST_SYNC_AT);
    const total = contacts.length;

    console.log(`📊 Contacts to process: ${total}`);

    const listBuckets = {};
    let processed = 0;

    for (const contact of contacts) {
      processed++;

      const props = contact.properties;
      if (!props?.email) continue;

      const forms = await fetchContactForms(contact.id);
      if (!forms.length) continue;

      const formTitles = [
        ...new Set(forms.map(f => f.title).filter(Boolean)),
      ];

      const matchedLists = formTitles
        .map(title => FORM_TO_LIST_MAP[title])
        .filter(Boolean);

      if (!matchedLists.length) continue;

      const profileId = await upsertProfile({
        email: props.email,
        firstName: props.firstname,
        lastName: props.lastname,
        phone: props.phone,
        company: props.company,
      });

      for (const listId of matchedLists) {
        if (!listBuckets[listId]) listBuckets[listId] = [];
        listBuckets[listId].push(profileId);
      }

      if (processed % 50 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const eta = Math.round((total - processed) / rate / 60);

        console.log(
          `📈 ${processed}/${total} (${Math.round(
            (processed / total) * 100
          )}%) — ETA ~${eta} min`
        );
      }
    }

    for (const [listId, profileIds] of Object.entries(listBuckets)) {
      console.log(`🚀 Syncing ${profileIds.length} profiles to list ${listId}`);
      await batchAddToList(listId, profileIds);
    }

    console.log('✅ Sync completed successfully');

    // REQUIRED: GitHub Actions parses this to update LAST_SYNC_AT
    console.log(`__SYNC_COMPLETED_AT__=${new Date().toISOString()}`);
  } catch (err) {
    console.error('❌ Sync failed:', err.response?.data || err.message);
    process.exit(1);
  }
})();
