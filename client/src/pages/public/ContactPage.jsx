import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiMail, FiPhone, FiMapPin, FiSend } from 'react-icons/fi';
import toast from 'react-hot-toast';
import useSiteSettings from '../../hooks/useSiteSettings';

const ContactPage = () => {
  const { settings } = useSiteSettings();
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

  const title = settings.contactTitle || 'Contact Us';
  const subtitle = settings.contactSubtitle || "Have questions? We'd love to hear from you.";
  const email = settings.contactEmail || 'info.stackamit@gmail.com';
  const phone = settings.contactPhone || '+91-9031580441';
  const address = settings.contactAddress || 'Jaipur, Rajasthan, India (303901)';

  const handleSubmit = (e) => {
    e.preventDefault();
    toast.success('Message sent successfully! We will get back to you soon.');
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <div className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-dark-900 dark:text-white">{title}</h1>
          <p className="mt-4 text-lg text-dark-500 dark:text-dark-400">{subtitle}</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            {[
              { icon: <FiMail size={24} />, title: 'Email', info: email },
              { icon: <FiPhone size={24} />, title: 'Phone', info: phone },
              { icon: <FiMapPin size={24} />, title: 'Address', info: address },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="card p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400">{item.icon}</div>
                <div>
                  <p className="font-semibold text-dark-900 dark:text-white">{item.title}</p>
                  <p className="text-dark-500 dark:text-dark-400 text-sm">{item.info}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="lg:col-span-2 card p-8">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="label">Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="Your name" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input-field" placeholder="your@email.com" required />
              </div>
            </div>
            <div className="mt-6">
              <label className="label">Subject</label>
              <input type="text" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="input-field" placeholder="How can we help?" required />
            </div>
            <div className="mt-6">
              <label className="label">Message</label>
              <textarea rows={5} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="input-field resize-none" placeholder="Your message..." required />
            </div>
            <button type="submit" className="mt-6 btn-primary flex items-center gap-2">
              <FiSend size={16} /> Send Message
            </button>
          </motion.form>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
