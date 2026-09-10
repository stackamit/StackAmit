import { motion } from 'framer-motion';
import { FiTarget, FiEye, FiHeart } from 'react-icons/fi';
import useSiteSettings from '../../hooks/useSiteSettings';

const AboutPage = () => {
  const { settings } = useSiteSettings();

  const title = settings.aboutTitle || 'About StackAmit';
  const subtitle = settings.aboutSubtitle || 'Bridging the gap between education and industry through innovative internship programs.';
  const mission = settings.aboutMission || 'To empower students with practical skills, industry exposure, and professional certifications that accelerate their career growth.';
  const vision = settings.aboutVision || 'To become the leading internship platform that transforms aspiring professionals into industry-ready experts.';
  const values = settings.aboutValues || 'Excellence, innovation, accessibility, and commitment to student success drive everything we do.';
  const community = settings.aboutCommunity || 'Since our inception, we have helped hundreds of students gain real-world experience, build professional networks, and launch successful careers in technology and beyond.';

  return (
    <div className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-dark-900 dark:text-white">{title}</h1>
          <p className="mt-4 text-lg text-dark-500 dark:text-dark-400 max-w-2xl mx-auto">
            {subtitle}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {[
            { icon: <FiTarget size={32} />, title: 'Our Mission', desc: mission },
            { icon: <FiEye size={32} />, title: 'Our Vision', desc: vision },
            { icon: <FiHeart size={32} />, title: 'Our Values', desc: values },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="card p-8 text-center">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center text-primary-600 dark:text-primary-400 mx-auto">
                {item.icon}
              </div>
              <h3 className="mt-6 text-xl font-bold text-dark-900 dark:text-white">{item.title}</h3>
              <p className="mt-3 text-dark-500 dark:text-dark-400">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="card p-8 md:p-12 bg-gradient-to-r from-primary-600 to-primary-800 text-white text-center">
          <h2 className="text-3xl font-bold">Join Our Growing Community</h2>
          <p className="mt-4 text-primary-100 max-w-2xl mx-auto">
            {community}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default AboutPage;
