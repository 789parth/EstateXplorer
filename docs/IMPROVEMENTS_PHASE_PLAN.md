# Phase-Wise Implementation Plan: EstateXplorer Improvements

This plan covers every improvement and fix requested in the specification document. Every requirement is mapped across Frontend and Backend files without omitting anything or adding unsolicited changes.

---

## Overview of Requirements & Scope

1. **Builder Listing Form Commission**:
   - When "Allow Agents to Acquire / Represent This Project" (`allowAgentAcquisition`) is checked, commission amount must be replaced with **Commission Percentage (%)** and it must be a **required** field.
2. **Agent Message in Builder's "Agent requests"**:
   - Builder must see the message sent by the agent (`proposalNotes` / `message`) in the "Agent Requests" list / table.
3. **Builder Request Rejection with Reason & Agent Visibility**:
   - When a builder rejects a partnership request, the builder must be prompted for a **rejection reason**.
   - This rejection reason must be saved and displayed on that particular project/property in the Agent Dashboard (`Find Projects & Properties` and `My Affiliations`).
4. **Remove Agent's Affiliated Referral Link**:
   - Remove the affiliate referral link column / UI from both Builder's Agent Requests and Agent's Affiliations dashboard views.
5. **Agent "Find Projects & Properties" Commission Display**:
   - In the Agent's Discover cards, show both the **commission percentage (%)** and the calculated **commission amount (₹)** based on the project/property price.
6. **KYC Verification Filter Fix in Admin Dashboard**:
   - Fix the filter glitch in Admin KYC Document Verification where selecting "Pending" shows verified users or empty state incorrectly.
7. **Graphical Status Display on Builder Dashboard for KYC**:
   - Graphically display the document verification progress / status (e.g. Under Progress or Rejected with Reason) on the Builder Dashboard projects portfolio.
8. **Disable Submit Button in KYC Modal When Request is Sent & Re-enable on Rejection**:
   - When a document verification request is submitted / pending, the submit button should be disabled ("Verification Under Admin Review").
   - If the request is rejected, re-enable the button for resubmission.
9. **Documentation Section: Allow Adding Optional Document After Verification**:
   - In the profile document verification section, allow users whose mandatory documents (Aadhar & PAN) are already approved to upload / update their optional documents (Company / Agency certificate).
10. **Homepage / End-User Property Price with Agent Commission**:
    - When a property/project has an assigned agent, calculate and display the total price (property price + agent commission) to end-buyers.
11. **Auto-Fill Phone Number in Inquiry and Site Visit Modals**:
    - Ensure the logged-in user's phone number is pre-filled by default in the "Send Free Inquiry" and "Book a Site Visit" modals alongside Name and Email.

---

## Phase-by-Phase Plan

### Phase 1: Property Listing Commission Configuration (Builder)
- **Scope**:
  - Replace "Commission Amount (₹)" with "Commission Percentage (%)" in property/project creation & editing.
  - Make Commission Percentage mandatory when "Allow Agents to Acquire / Represent This Project" is checked.
- **Frontend Changes**:
  - [`client/src/components/dashboard/AddPropertyModal.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/components/dashboard/AddPropertyModal.jsx):
    - Replace input field `commissionAmount` with `defaultCommissionRate` (Commission Percentage, %).
    - Add required validation rules when `allowAgentAcquisition` is true (`min: 0.1, max: 100`).
    - Adjust label to `Commission Percentage (%)` with `% e.g. 2.5` placeholder and helper text.
- **Backend Changes**:
  - [`server/controllers/propertyController.js`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/server/controllers/propertyController.js):
    - In `createProperty` and `updateProperty`, validate and persist `defaultCommissionRate` when `allowAgentAcquisition` is true.

---

### Phase 2: Agent Requests Message, Rejection Reason & Link Removal (Builder & Agent)
- **Scope**:
  - Show the Agent's message (`proposalNotes`) in Builder's "Agent requests" table.
  - Require rejection reason modal when builder clicks "Reject".
  - Show rejection reason to the agent on the project/property card in Agent Dashboard.
  - Remove the Affiliate Referral Link from Builder's table and Agent's Affiliations card.
- **Backend Changes**:
  - [`server/services/partnershipService.js`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/server/services/partnershipService.js):
    - Ensure `proposalNotes` and `rejectionReason` are populated and returned in `getBuilderPartnerships` and `getAgentPartnerships`.
    - Update `updatePartnershipStatus` to enforce and record `rejectionReason` on rejection.
  - [`server/controllers/partnershipController.js`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/server/controllers/partnershipController.js):
    - In `updatePartnershipStatus`, accept `rejectionReason` and reject with HTTP 400 if missing on rejection.
- **Frontend Changes**:
  - [`client/src/pages/dashboard/BuilderDashboard.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/pages/dashboard/BuilderDashboard.jsx):
    - Display Agent's Message (`req.proposalNotes`) in the Agent Requests table / row details.
    - Add rejection reason modal when clicking "Reject" before calling API.
    - Remove "Affiliate Referral Link" column and cell from Agent Requests table.
  - [`client/src/pages/dashboard/AgentDashboard.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/pages/dashboard/AgentDashboard.jsx):
    - Remove "Client Referral Tracking Link" / "Copy Link" box from Affiliated cards.
    - In both Find Projects cards and Affiliations tab, when status is rejected, prominently show builder's `rejectionReason`.

---

### Phase 3: Agent Discover Commission Display (Percentage + Amount)
- **Scope**:
  - In Agent Dashboard (`Find Projects & Properties` / Discover tab), display both Commission Percentage (%) and Commission Price (₹) calculated from project/property price.
- **Frontend Changes**:
  - [`client/src/pages/dashboard/AgentDashboard.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/pages/dashboard/AgentDashboard.jsx):
    - Under "Offered Commission", show `X% (₹ Y,YY,YYY)` calculated from `item.defaultCommissionRate` and `item.price`.
- **Backend Changes**:
  - [`server/controllers/partnershipController.js`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/server/controllers/partnershipController.js):
    - In `discoverProjects`, ensure `defaultCommissionRate`, `commissionAmount`, and `price` are projected and returned.

---

### Phase 4: KYC Admin Filter Glitch & Document Management
- **Scope**:
  - Fix the KYC verification filtering in Admin Dashboard so selecting "Pending", "Verified", or "Rejected" returns accurate users and doesn't mismatch role-specific statuses.
  - In [`ApprovedVerificationDocumentsSection.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/components/dashboard/ApprovedVerificationDocumentsSection.jsx), allow uploading optional documents (Company / Agency doc) even after Aadhar and PAN are verified.
  - In [`KycVerificationModal.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/components/dashboard/KycVerificationModal.jsx), disable the "Submit Documents" button when status is `pending` ("Verification Under Admin Review"). Re-enable button when status is `rejected` or `unverified`.
- **Backend Changes**:
  - [`server/controllers/adminController.js`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/server/controllers/adminController.js):
    - In `getKycRequests`, align Mongo query and unpack loop: correctly filter by `roleKycVerification.<role>.status` to avoid returning verified users when "pending" is chosen.
- **Frontend Changes**:
  - [`client/src/pages/dashboard/AdminDashboard.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/pages/dashboard/AdminDashboard.jsx):
    - Pass active filters cleanly and ensure empty state only appears when list is truly empty.
  - [`client/src/components/dashboard/KycVerificationModal.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/components/dashboard/KycVerificationModal.jsx):
    - Disable submit button with tooltip/indicator when `currentStatus === 'pending'`. Re-enable when `rejected` or `unverified`.
  - [`client/src/components/dashboard/ApprovedVerificationDocumentsSection.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/components/dashboard/ApprovedVerificationDocumentsSection.jsx):
    - When verified, show an "Upload Optional Document" action for missing optional company/agency documents.

---

### Phase 5: Dashboard Graphical KYC Progress & Verification Status
- **Scope**:
  - Display a prominent graphical status banner in Builder Dashboard (under Projects & Properties / portfolio header) showing the current KYC progress (e.g., "Verification Under Review" or "Verification Rejected: [Reason]" with re-upload action).
- **Frontend Changes**:
  - [`client/src/pages/dashboard/BuilderDashboard.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/pages/dashboard/BuilderDashboard.jsx):
    - Add a banner right above the projects portfolio cards/table displaying KYC verification status with status icon, timeline progress, rejection details (if rejected), and upload CTA.

---

### Phase 6: Buyer End-User Price Calculation & Modal Phone Pre-fill
- **Scope**:
  - If a property or project has an assigned agent, add commission to the displayed price on Property Details, Listings, and Homepage cards.
  - Auto-fill user's phone number by default in "Send Free Inquiry" and "Book a Site Visit" modals.
- **Frontend Changes**:
  - [`client/src/pages/PropertyDetail.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/pages/PropertyDetail.jsx):
    - Pre-fill `form.phone` with `user.phone` inside `useEffect([user])`.
    - If `assignedAgent` is present, display total price including agent commission.
  - [`client/src/components/home/PropertyCard.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/components/home/PropertyCard.jsx) & [`client/src/components/home/ProjectCard.jsx`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/client/src/components/home/ProjectCard.jsx):
    - Reflect total price inclusive of agent commission when `assignedAgent` exists.
- **Backend Changes**:
  - [`server/controllers/propertyController.js`](file:///c:/Users/Soldier_Of_God/Downloads/EstateXplorer/server/controllers/propertyController.js):
    - Ensure `defaultCommissionRate`, `commissionAmount`, and `assignedAgent` are included in public listing queries so client can compute effective buyer price.
