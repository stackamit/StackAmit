import { Link } from 'react-router-dom';
import {
  FiArrowLeft,
  FiFileText,
  FiCheckCircle,
  FiShield,
  FiUsers,
  FiClock,
  FiAward,
} from 'react-icons/fi';

const TermsAndConditionsPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Back Button */}
        <Link
          to="/register"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 mb-8 transition-colors"
        >
          <FiArrowLeft size={18} />
          Back to Registration
        </Link>

        {/* Main Card */}
        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg border border-gray-100 dark:border-dark-700 overflow-hidden">

          {/* Header */}
          <div className="bg-primary-600 px-6 sm:px-10 py-10 text-white">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center">
                <FiFileText size={28} />
              </div>

              <div>
                <p className="text-sm text-white/80 font-medium">
                  StackAmit Internship Platform
                </p>

                <h1 className="text-2xl sm:text-3xl font-bold mt-1">
                  Internship Terms & Conditions
                </h1>
              </div>
            </div>

            <p className="text-white/90 leading-relaxed max-w-3xl">
              Please read these Internship Terms & Conditions carefully before
              registering, applying for an internship, or participating in any
              internship program offered through the StackAmit Internship
              Management Platform.
            </p>

            <div className="flex flex-wrap gap-3 mt-6">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg text-sm">
                <FiShield size={16} />
                Professional Standards
              </div>

              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg text-sm">
                <FiUsers size={16} />
                Student Responsibilities
              </div>

              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg text-sm">
                <FiAward size={16} />
                Certificate Eligibility
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 sm:px-10 py-10 space-y-10">

            {/* Introduction */}
            <div className="p-5 rounded-xl bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30">
              <p className="text-dark-600 dark:text-dark-300 leading-relaxed">
                This Internship Terms & Conditions document governs the
                participation of students in internship programs offered through
                the StackAmit Internship Management Platform.
              </p>
            </div>

            {/* 1 */}
            <Section title="1. Acceptance of Terms">
              <p>
                By registering on the platform, applying for an internship, or
                participating in an internship program, you confirm that you
                have carefully read, understood, and agreed to these Terms &
                Conditions.
              </p>

              <p>
                If you do not agree with any part of these terms, you should not
                register for or participate in the internship program.
              </p>
            </Section>

            {/* 2 */}
            <Section title="2. Internship Application">
              <p>
                Students may apply for available internship programs through the
                platform. Submission of an application does not guarantee
                selection or acceptance into an internship program.
              </p>

              <p>
                The administration reserves the right to review, approve,
                reject, or cancel an internship application based on eligibility,
                availability, academic requirements, or other relevant criteria.
              </p>
            </Section>

            {/* 3 */}
            <Section title="3. Student Responsibilities">
              <p>
                Interns are expected to provide accurate and complete
                information during registration and throughout the internship
                program.
              </p>

              <p className="font-semibold text-dark-800 dark:text-white">
                Students must:
              </p>

              <BulletList
                items={[
                  'Maintain professional behavior while participating in the internship.',
                  'Complete assigned tasks and projects within the specified deadlines.',
                  'Attend scheduled training sessions, meetings, and discussions as required.',
                  'Communicate respectfully with administrators, trainers, mentors, and other students.',
                  'Avoid submitting copied, plagiarized, or fraudulent work.',
                  'Follow all instructions and guidelines provided by the assigned trainer or administrator.',
                ]}
              />
            </Section>

            {/* 4 */}
            <Section title="4. Trainer and Batch Assignment">
              <p>
                After approval of an internship application, the administrator
                may assign the student to a specific trainer, mentor, batch,
                project, or internship program.
              </p>

              <p>
                The platform administration reserves the right to change trainer
                assignments, batches, schedules, projects, or other
                internship-related arrangements when necessary.
              </p>
            </Section>

            {/* 5 */}
            <Section title="5. Internship Duration">
              <p>
                The duration of the internship may vary depending on the
                selected internship program, such as one month, three months, or
                another specified period.
              </p>

              <p>
                Students are expected to complete the internship requirements
                within the assigned duration.
              </p>

              <p>
                Failure to actively participate or complete the required work
                may affect internship completion status and eligibility for a
                certificate.
              </p>
            </Section>

            {/* 6 */}
            <Section title="6. Tasks and Project Work">
              <p>
                Students may receive tasks, assignments, projects, assessments,
                or other learning activities during the internship.
              </p>

              <p>
                All submitted work must be the student's own work unless
                collaboration has been explicitly permitted.
              </p>

              <p>
                The trainer or administrator may review submitted work and
                request corrections, improvements, or resubmission.
              </p>
            </Section>

            {/* 7 */}
            <Section title="7. Communication and Discussion Platform">
              <p>
                The platform may provide live chat, project discussions, class
                discussions, or other communication features.
              </p>

              <p>
                Students must use these features responsibly and professionally.
              </p>

              <p className="font-semibold text-dark-800 dark:text-white">
                The following activities are prohibited:
              </p>

              <BulletList
                items={[
                  'Harassment, abuse, or inappropriate behavior.',
                  'Sharing offensive or illegal content.',
                  'Spam or unauthorized promotional messages.',
                  'Sharing confidential information without authorization.',
                  'Impersonating another student, trainer, or administrator.',
                ]}
              />

              <p>
                Violation of these rules may result in suspension or termination
                of platform access.
              </p>
            </Section>

            {/* 8 */}
            <Section title="8. Attendance and Participation">
              <p>
                Students are responsible for maintaining active participation
                throughout the internship period.
              </p>

              <p>
                Repeated absence, inactivity, failure to complete assigned
                tasks, or failure to respond to official communication may
                result in removal from the internship program.
              </p>
            </Section>

            {/* 9 */}
            <Section title="9. Internship Certificate">
              <p>
                An internship certificate may be issued only after the student
                successfully fulfills the required internship conditions.
              </p>

              <p className="font-semibold text-dark-800 dark:text-white">
                Certificate eligibility may depend on:
              </p>

              <BulletList
                items={[
                  'Successful completion of the required internship duration.',
                  'Completion of assigned tasks and projects.',
                  'Satisfactory participation and performance.',
                  'Compliance with platform rules and internship requirements.',
                ]}
              />

              <p>
                The administration reserves the right to withhold a certificate
                if the completion requirements are not met.
              </p>
            </Section>

            {/* 10 */}
            <Section title="10. Accuracy of Information">
              <p>
                Students are responsible for ensuring that all information
                provided during registration is accurate.
              </p>

              <p>
                Providing false, misleading, or fraudulent information may
                result in rejection of the application, termination of the
                internship, suspension of the account, or cancellation of any
                issued certificate where legally appropriate.
              </p>
            </Section>

            {/* 11 */}
            <Section title="11. Intellectual Property and Project Work">
              <p>
                Projects, assignments, code, documents, designs, and other work
                created during the internship may be used for educational,
                training, evaluation, or portfolio purposes, subject to the
                applicable internship guidelines.
              </p>

              <p>
                Students must respect the intellectual property, confidential
                information, and proprietary materials of the organization.
              </p>
            </Section>

            {/* 12 */}
            <Section title="12. Account Security">
              <p>
                Students are responsible for maintaining the confidentiality of
                their account credentials.
              </p>

              <p>
                Users must not share their passwords or allow unauthorized
                individuals to access their accounts.
              </p>

              <p>
                The platform is not responsible for issues resulting from
                unauthorized access caused by the user's failure to protect their
                account credentials.
              </p>
            </Section>

            {/* 13 */}
            <Section title="13. Suspension or Termination">
              <p>
                The administrator reserves the right to suspend or terminate a
                student's account or internship participation in cases
                including:
              </p>

              <BulletList
                items={[
                  'Violation of these Terms & Conditions.',
                  'Misconduct or inappropriate behavior.',
                  'Submission of fraudulent or plagiarized work.',
                  'Abuse of the platform or communication system.',
                  'Providing false information.',
                  'Any activity that may harm the platform, organization, trainers, students, or other users.',
                ]}
              />
            </Section>

            {/* 14 */}
            <Section title="14. Changes to the Internship Program">
              <p>
                The organization may modify internship schedules, training
                content, tasks, trainers, program requirements, or other
                aspects of the internship when necessary.
              </p>

              <p>
                Reasonable efforts will be made to communicate significant
                changes to affected students.
              </p>
            </Section>

            {/* 15 */}
            <Section title="15. Privacy and Data">
              <p>
                The platform may collect and process information provided by
                students for purposes related to registration, internship
                management, communication, trainer assignment, batch management,
                project evaluation, and certificate generation.
              </p>

              <p>
                Student information will be handled in accordance with applicable
                platform policies and relevant legal requirements.
              </p>
            </Section>

            {/* 16 */}
            <Section title="16. Limitation of Liability">
              <p>
                The internship program is intended for educational, training,
                and professional development purposes.
              </p>

              <p>
                The organization does not guarantee employment, placement, job
                offers, or any specific professional outcome after completion of
                the internship.
              </p>
            </Section>

            {/* 17 */}
            <Section title="17. Contact and Support">
              <p>
                For questions, concerns, or issues related to the internship
                program, students should contact the platform administrator or
                use the official support channels provided through the platform.
              </p>
            </Section>

            {/* 18 */}
            <div className="rounded-xl border-2 border-primary-100 dark:border-primary-900/40 bg-primary-50 dark:bg-primary-900/10 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-lg bg-primary-600 text-white flex items-center justify-center">
                  <FiCheckCircle size={23} />
                </div>

                <h2 className="text-xl font-bold text-dark-900 dark:text-white">
                  18. Agreement
                </h2>
              </div>

              <p className="text-dark-600 dark:text-dark-300 leading-relaxed mb-4">
                By selecting the checkbox stating:
              </p>

              <div className="bg-white dark:bg-dark-800 border border-primary-200 dark:border-primary-800 rounded-lg px-5 py-4 mb-4">
                <p className="font-semibold text-primary-600 dark:text-primary-400">
                  “I have carefully read the Internship Terms & Conditions.”
                </p>
              </div>

              <p className="text-dark-600 dark:text-dark-300 leading-relaxed">
                You confirm that you have read, understood, and agreed to comply
                with these Internship Terms & Conditions.
              </p>
            </div>

            {/* Last Updated */}
            <div className="border-t border-gray-200 dark:border-dark-700 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-dark-500 dark:text-dark-400">
                <FiClock size={17} />
                <span>Last Updated: August 22, 2026</span>
              </div>

              <Link
                to="/register"
                className="btn-primary inline-flex items-center justify-center gap-2"
              >
                <FiArrowLeft size={17} />
                Back to Registration
              </Link>
            </div>

          </div>
        </div>

        

      </div>
    </div>
  );
};


/* =========================
   Reusable Section Component
========================= */

const Section = ({ title, children }) => {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-dark-900 dark:text-white mb-4">
        {title}
      </h2>

      <div className="space-y-4 text-dark-600 dark:text-dark-300 leading-relaxed">
        {children}
      </div>
    </section>
  );
};


/* =========================
   Reusable Bullet List
========================= */

const BulletList = ({ items }) => {
  return (
    <ul className="space-y-3 pl-1">
      {items.map((item, index) => (
        <li
          key={index}
          className="flex items-start gap-3 text-dark-600 dark:text-dark-300"
        >
          <FiCheckCircle
            className="text-primary-600 dark:text-primary-400 mt-1 flex-shrink-0"
            size={17}
          />

          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};

export default TermsAndConditionsPage;