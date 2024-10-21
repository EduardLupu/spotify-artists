'use client'

import Link from "next/link";
import React from "react";

const Footer = () => {
    return (
        <section className="px-6 lg:px-24 bg-white h-full mt-auto pt-6">
            <p className="text-black text-center text-xs font-bold">this project is open-source. any help is
                appreciated. feel free to contribute on <Link href={'https://github.com/EduardLupu/spotify-artists'}
                                                              title={'View on GitHub'}
                                                              className="underline underline-offset-4"
                                                              target={'_blank'}>github</Link>.
                support me on <Link href={'https://buymeacoffee.com/eduardlupu'} title={'Buy me a coffee'}
                                    className="underline underline-offset-4"
                                    target={'_blank'}>buymeacoffee</Link> or <Link
                    href={'https://github.com/sponsors/EduardLupu'} target={'_blank'} title={'GitHub Sponsors'}
                    className="underline underline-offset-4">github sponsors</Link>.
            </p>
            <p className={'text-black text-center text-xs font-bold my-6'}>&copy; {new Date().getFullYear()} created
                by <Link href={'https://eduardlupu.com/'} title={'check out my personal site'}
                         className="underline underline-offset-4" target={'_blank'}>eduard lupu</Link></p>
        </section>
    )
}

export default Footer;