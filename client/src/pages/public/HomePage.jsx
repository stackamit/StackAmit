import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowRight, FiCheckCircle, FiUsers, FiAward, FiBriefcase, FiZap, FiShield, FiGlobe, FiSearch, FiCamera } from 'react-icons/fi';
import { FaLinkedin, FaYoutube, FaFacebook, FaInstagram, FaGithub } from 'react-icons/fa';
import useSiteSettings from '../../hooks/useSiteSettings';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

const HomePage = () => {
  const { settings } = useSiteSettings();

  const heroBadge = settings.heroBadge || 'Now Enrolling for 2026';
  const heroTitle = settings.heroTitle || 'Launch Your Career with StackAmit';
  const heroSubtitle = settings.heroSubtitle || 'Join our professional internship programs designed to bridge the gap between academic learning and industry demands. Get mentored by experts, build real projects, and earn recognized certificates.';
  const statStudents = settings.statStudents || '500+';
  const statTrainers = settings.statTrainers || '50+';
  const statSuccessRate = settings.statSuccessRate || '95%';
  const whyTitle = settings.whyTitle || 'Why Choose StackAmit?';
  const whySubtitle = settings.whySubtitle || 'We provide a complete ecosystem for learning, growth, and career advancement.';
  const ctaTitle = settings.ctaTitle || 'Ready to Start Your Journey?';
  const ctaSubtitle = settings.ctaSubtitle || 'Join hundreds of students who have launched their careers with StackAmit.';

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-400/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-400/20 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeInUp}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium mb-6">
                <FiZap size={14} /> {heroBadge}
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-dark-900 dark:text-white leading-tight">
                {heroTitle}
              </h1>
              <p className="mt-6 text-lg text-dark-600 dark:text-dark-300 leading-relaxed max-w-lg">
                {heroSubtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/register" className="btn-primary flex items-center gap-2 text-base py-3 px-8">
                  Get Started <FiArrowRight />
                </Link>
                <Link to="/about" className="btn-outline text-base py-3 px-8">
                  Learn More
                </Link>
              </div>
              <div className="mt-10 flex items-center gap-8">
                <div><p className="text-3xl font-bold text-dark-900 dark:text-white">{statStudents}</p><p className="text-sm text-dark-500">Students Placed</p></div>
                <div className="w-px h-12 bg-dark-200 dark:bg-dark-700"></div>
                <div><p className="text-3xl font-bold text-dark-900 dark:text-white">{statTrainers}</p><p className="text-sm text-dark-500">Expert Trainers</p></div>
                <div className="w-px h-12 bg-dark-200 dark:bg-dark-700"></div>
                <div><p className="text-3xl font-bold text-dark-900 dark:text-white">{statSuccessRate}</p><p className="text-sm text-dark-500">Success Rate</p></div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="hidden lg:block">
              <div className="relative">
                <div className="w-full h-96 bg-gradient-to-br from-primary-600 to-primary-400 rounded-3xl shadow-2xl flex items-center justify-center">
                  <div className="text-center text-white p-8">
                    <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FiAward size={40} />
                    </div>
                    <h3 className="text-2xl font-bold">Certified Programs</h3>
                    <p className="text-white/80 mt-2">Industry-recognized certificates</p>
                  </div>
                </div>
                <div className="absolute -bottom-6 -left-6 w-48 h-48 bg-secondary-500 rounded-2xl shadow-lg flex items-center justify-center text-white">
                  <div className="text-center p-4">
                    <FiBriefcase size={32} className="mx-auto mb-2" />
                    <p className="font-bold">Real Projects</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-white">{whyTitle}</h2>
            <p className="mt-4 text-lg text-dark-500 dark:text-dark-400 max-w-2xl mx-auto">
              {whySubtitle}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: <FiUsers size={24} />, title: 'Expert Mentorship', desc: 'Learn directly from industry professionals with years of real-world experience.' },
              { icon: <FiBriefcase size={24} />, title: 'Real Projects', desc: 'Work on live projects that build your portfolio and practical skills.' },
              { icon: <FiAward size={24} />, title: 'Certified Programs', desc: 'Earn industry-recognized certificates upon successful completion.' },
              { icon: <FiZap size={24} />, title: 'Flexible Learning', desc: 'Choose from various durations and schedules that fit your lifestyle.' },
              { icon: <FiShield size={24} />, title: 'Secure Platform', desc: 'Enterprise-grade security for your data and learning materials.' },
              { icon: <FiGlobe size={24} />, title: 'Global Community', desc: 'Connect with peers and professionals from around the world.' },
            ].map((feature, i) => (
              <motion.div key={i} {...fadeInUp} transition={{ delay: i * 0.1 }} className="card p-6 group hover:scale-[1.02] transition-transform">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-dark-900 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-dark-500 dark:text-dark-400">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Internship Categories */}
      <section className="py-20 bg-dark-50 dark:bg-dark-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-white">Internship Categories</h2>
            <p className="mt-4 text-lg text-dark-500 dark:text-dark-400">Explore our diverse range of professional programs</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Web Development', category: 'Web Development' },
              { label: 'Data Science', category: 'Data Science' },
              { label: 'UI/UX Design', category: 'UI/UX Design' },
              { label: 'Digital Marketing', category: 'Digital Marketing' },
              { label: 'Mobile Development', category: 'Mobile Development' },
              { label: 'Cloud Computing', category: 'Cloud Computing' },
              { label: 'AI & ML', category: 'Artificial Intelligence' },
              { label: 'Cyber Security', category: 'Cyber Security' },
            ].map((item, i) => (
              <Link key={item.label} to={`/internships?category=${encodeURIComponent(item.category)}`}>
                <motion.div {...fadeInUp} transition={{ delay: i * 0.05 }} className="card p-5 text-center hover:scale-[1.03] transition-transform cursor-pointer group">
                  <h3 className="font-semibold text-dark-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{item.label}</h3>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-800">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div {...fadeInUp}>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">{ctaTitle}</h2>
            <p className="mt-4 text-lg text-primary-100">{ctaSubtitle}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/register" className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold py-3 px-8 rounded-lg hover:bg-primary-50 transition-colors shadow-lg">
                Register Now <FiArrowRight />
              </Link>
              <Link to="/verify-certificate" className="inline-flex items-center gap-2 border-2 border-white text-white font-semibold py-3 px-8 rounded-lg hover:bg-white/10 transition-colors">
                <FiShield size={18} /> Verify Certificate
              </Link>
              <Link to="/scan-certificate" className="inline-flex items-center gap-2 border-2 border-white/50 text-white/90 font-semibold py-3 px-8 rounded-lg hover:bg-white/10 transition-colors">
                <FiCamera size={18} /> Scan QR
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Certificate Verification Banner */}
      <section className="py-16 bg-white dark:bg-dark-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            {...fadeInUp}
            className="card p-8 flex flex-col sm:flex-row items-center gap-6 border-2 border-primary-100 dark:border-primary-900/30"
          >
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center flex-shrink-0">
              <FiShield size={32} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-xl font-bold text-dark-900 dark:text-white">Verify Certificate Authenticity</h3>
              <p className="text-dark-500 dark:text-dark-400 mt-1">
                Employers and institutions can verify any StackAmit certificate using its unique certificate number or scan the QR code.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
              <Link
                to="/verify-certificate"
                className="btn-primary flex items-center gap-2 text-sm py-3 px-6"
              >
                <FiSearch size={16} /> Verify Now
              </Link>
              <Link
                to="/scan-certificate"
                className="btn-outline flex items-center gap-2 text-sm py-3 px-6"
              >
                <FiCamera size={16} /> Scan QR
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white dark:bg-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-white">What Our Students Say</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: 'Priya Sharma', role: 'Web Development Intern', text: 'StackAmit gave me the practical experience I needed. The mentorship was outstanding and the projects were real-world relevant.' },
              { name: 'Rahul Kumar', role: 'Data Science Intern', text: 'The structured learning path and expert guidance helped me transition from academics to industry seamlessly.' },
              { name: 'Anita Desai', role: 'UI/UX Design Intern', text: 'I built an amazing portfolio during my internship. The certificate added significant value to my resume.' },
            ].map((t, i) => (
              <motion.div key={i} {...fadeInUp} transition={{ delay: i * 0.1 }} className="card p-6">
                <div className="flex items-center gap-1 text-yellow-400 mb-4">
                  {[...Array(5)].map((_, j) => <FiCheckCircle key={j} size={16} />)}
                </div>
                <p className="text-dark-600 dark:text-dark-300 italic">"{t.text}"</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-primary-300 flex items-center justify-center text-white font-semibold text-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-dark-900 dark:text-white text-sm">{t.name}</p>
                    <p className="text-xs text-dark-500">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-dark-50 dark:bg-dark-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeInUp} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-white">Frequently Asked Questions</h2>
          </motion.div>

          <div className="space-y-4">
            {[
              { q: 'How do I apply for an internship?', a: 'Simply register on our platform, complete your profile, and browse available internships. Click apply on any program you are interested in.' },
              { q: 'Are the certificates recognized?', a: 'Yes! Our certificates are industry-recognized and come with unique verification IDs that employers can validate.' },
              { q: 'What is the duration of programs?', a: 'Programs range from 4 to 12 weeks depending on the category and depth of the internship.' },
              { q: 'Is there any fee to participate?', a: 'Our internship programs are free for students. We believe in accessible education for all.' },
            ].map((faq, i) => (
              <motion.details key={i} {...fadeInUp} transition={{ delay: i * 0.05 }} className="card p-5 group">
                <summary className="font-semibold text-dark-900 dark:text-white cursor-pointer list-none flex justify-between items-center">
                  {faq.q}
                  <span className="text-primary-600 group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <p className="mt-3 text-dark-500 dark:text-dark-400">{faq.a}</p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* Social Media / Follow Us */}
      <section className="py-20 bg-white dark:bg-dark-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeInUp}>
            <h2 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-white">Follow Us</h2>
            <p className="mt-4 text-lg text-dark-500 dark:text-dark-400 max-w-2xl mx-auto">
              Stay connected with us on social media for the latest updates, tips, and community highlights.
            </p>
          </motion.div>

          <motion.div {...fadeInUp} transition={{ delay: 0.2 }} className="mt-10 flex flex-wrap justify-center gap-6">
            {[
              { key: 'socialLinkedin', icon: <FaLinkedin size={28} />, label: 'LinkedIn', color: 'hover:text-blue-600 hover:border-blue-600', bg: 'hover:bg-blue-600' },
              { key: 'socialYoutube', icon: <FaYoutube size={28} />, label: 'YouTube', color: 'hover:text-red-600 hover:border-red-600', bg: 'hover:bg-red-600' },
              { key: 'socialFacebook', icon: <FaFacebook size={28} />, label: 'Facebook', color: 'hover:text-blue-700 hover:border-blue-700', bg: 'hover:bg-blue-700' },
              { key: 'socialInstagram', icon: <FaInstagram size={28} />, label: 'Instagram', color: 'hover:text-pink-600 hover:border-pink-600', bg: 'hover:bg-pink-600' },
              { key: 'socialGithub', icon: <FaGithub size={28} />, label: 'GitHub', color: 'hover:text-gray-800 hover:border-gray-800 dark:hover:text-white dark:hover:border-white', bg: 'hover:bg-gray-800 dark:hover:bg-white' },
            ].map((social) => {
              const url = settings[social.key];
              if (!url) return null;
              return (
                <a
                  key={social.key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dark-200 dark:border-dark-700 ${social.color} transition-all duration-300 hover:scale-105 hover:shadow-lg ${social.bg} hover:text-white hover:border-transparent`}
                  title={social.label}
                >
                  <span className="transition-transform duration-300 group-hover:scale-110">{social.icon}</span>
                  <span className="text-sm font-medium">{social.label}</span>
                </a>
              );
            })}
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
