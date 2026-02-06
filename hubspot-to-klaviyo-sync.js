// Enhanced debugging in hubspot-to-klaviyo-sync.js

// Function to process contacts
function processContacts(contacts) {
    let skippedNoEmail = 0;
    let skippedNoForms = 0;
    let skippedNoMatchingLists = 0;

    contacts.forEach(contact => {
        if (!contact.email) {
            skippedNoEmail++;
            return;
        }

        if (!contact.forms || contact.forms.length === 0) {
            skippedNoForms++;
            return;
        }

        // Assuming lists is an array of list IDs that the contact should be checked against
        if (!isInMatchingLists(contact)) {
            skippedNoMatchingLists++;
            return;
        }

        // Add code here to actually add the profile to Klaviyo
    });

    // Summary logging at the end of processing
    console.log(`Skipped contacts summary:`);
    console.log(`- No email: ${skippedNoEmail}`);
    console.log(`- No forms: ${skippedNoForms}`);
    console.log(`- No matching lists: ${skippedNoMatchingLists}`);
}

function isInMatchingLists(contact) {
    // Logic to determine if contact is in the appropriate lists
    return true; // Placeholder
}

// Example call
// processContacts(yourContactsArray);