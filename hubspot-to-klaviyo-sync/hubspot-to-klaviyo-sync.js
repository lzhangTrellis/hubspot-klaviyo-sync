// hubspot-to-klaviyo-sync.js

const logSkippedContacts = (contacts) => {
    const skippedContacts = contacts.filter(contact => !contact.email);
    console.log(`Skipped ${skippedContacts.length} contacts due to no email.`);
    // Additional logging for other skipped conditions
    const filteredByForms = contacts.filter(contact => !contact.forms || contact.forms.length === 0);
    console.log(`Skipped ${filteredByForms.length} contacts due to no forms.`);
    const filteredByLists = contacts.filter(contact => !contact.lists || contact.lists.length === 0);
    console.log(`Skipped ${filteredByLists.length} contacts due to no matching lists.`);
};

try {
    // Your existing sync logic goes here
    // Call logSkippedContacts at appropriate stages
} catch (error) {
    console.error('An error occurred during the sync:', error);
}
