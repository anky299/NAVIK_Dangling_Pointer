import type { FC } from 'react';

export interface HeroExperienceProps {
  autoPlay?: boolean;
  onEnterNavik?: () => void;
  checkSeenFlag?: boolean;
}

export declare const HeroExperience: FC<HeroExperienceProps>;
export default HeroExperience;

